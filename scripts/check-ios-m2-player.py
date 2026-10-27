"""Synthetic M2 player proof: guarded OCR/HID only, no gallery/AX/cloud writes."""
import argparse
import asyncio
import csv
import io
import json
import re
import struct
import subprocess
import uuid
from pathlib import Path
from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.services.installation_proxy import InstallationProxyService
from pymobiledevice3.services.house_arrest import HouseArrestService
from pymobiledevice3.services.accessibilityaudit import AccessibilityAudit
from ios_device_settings import set_dynamic_type
from pymobiledevice3.remote.userspace_tunnel import UserspaceRsdTunnel
from pymobiledevice3.remote.core_device.app_service import AppServiceService
from pymobiledevice3.remote.core_device.configuration_service import ConfigurationService
from pymobiledevice3.remote.core_device.screen_capture_service import ScreenCaptureService
from pymobiledevice3.remote.core_device.hid_service import touch_session, TOUCHSCREEN_STATE_CONTACT, TOUCHSCREEN_STATE_RELEASE


async def run(args):
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'scope': 'Synthetic M2 player only; guarded OCR/HID; no gallery or cloud writes',
              'checks': [], 'settings_restored': False, 'normal_launch_restored': False, 'status': 'failed'}
    def check(name, condition):
        report['checks'].append({'name': name, 'passed': bool(condition)})
        print(name + ': ' + ('passed' if condition else 'failed'), flush=True)
        if not condition: raise AssertionError(name)

    async with await create_using_usbmux() as lockdown:
        async with InstallationProxyService(lockdown) as installed:
            apps = await installed.get_apps()
        bundles = [b for b in apps if b == 'it.sn.app' or b.endswith('.it.sn.app')]
        if len(bundles) != 1: raise ValueError('Serve una sola build SN sul dispositivo USB.')
        bundle = bundles[0]
        async with UserspaceRsdTunnel() as rsd:
            async with ConfigurationService(rsd) as config:
                original_style = await config.get_user_interface_style()
                try:
                    for appearance in args.appearance:
                        async with await HouseArrestService.create(lockdown, bundle) as files, touch_session(rsd) as hid:
                            run_id = str(uuid.uuid4())
                            await config.set_user_interface_style(appearance)
                            environment = {'SN_M1_UI_FIXTURE': '1', 'SN_M1_FIXTURE_SCREEN': 'stories', 'SN_M2_UI_RUN_ID': run_id}
                            async with AppServiceService(rsd) as apps:
                                try:
                                    await apps.launch_application(bundle, environment=environment)
                                except Exception as error:
                                    # CoreDevice may race process termination between fixture runs.
                                    # Retry only this local launch once, never an app/network write.
                                    if 'process identifier' not in str(error):
                                        raise
                                    await asyncio.sleep(1)
                                    await apps.launch_application(bundle, environment=environment)
                            async def snapshot(name):
                                for _ in range(8):
                                    async with ScreenCaptureService(rsd) as screen:
                                        data = (await screen.capture_screenshot())['image']
                                    ocr = subprocess.run(['tesseract', 'stdin', 'stdout', 'tsv'], input=data,
                                                         capture_output=True, check=True, timeout=10)
                                    words = list(csv.DictReader(io.StringIO(ocr.stdout.decode()), delimiter='\t'))
                                    text = ' '.join(w['text'].casefold() for w in words if w['text'].strip())
                                    expected = r'collaudo m[1il]' if name in ('feed', 'before-prova') else r'collaudo m[2z]'
                                    marker = re.search(expected, text) and 'dati locali' in text
                                    if marker: break
                                    await asyncio.sleep(.5)
                                if not marker:
                                    report['frame_signals'] = {token: token in text for token in ('collaudo', 'm1', 'm2', 'dati', 'locali', 'seconda', 'storie')}
                                check(appearance + '_' + name + '_fixture', marker)
                                (args.output / (appearance + '-' + name + '.png')).write_bytes(data)
                                return text, words, struct.unpack('>II', data[16:24])
                            async def tap_word(word):
                                _, words, (width, height) = await snapshot('before-' + word)
                                matches = [w for w in words if w['text'].casefold() == word]
                                check(appearance + '_unique_' + word, len(matches) == 1)
                                target = matches[0]
                                x = round((int(target['left']) + int(target['width']) / 2) * 65535 / width)
                                y = round((int(target['top']) + int(target['height']) / 2) * 65535 / height)
                                await hid.send_touchscreen(TOUCHSCREEN_STATE_CONTACT, x, y)
                                await asyncio.sleep(.05)
                                await hid.send_touchscreen(TOUCHSCREEN_STATE_RELEASE, x, y)
                                await asyncio.sleep(.5)
                            async def media_requests():
                                data = json.loads(await files.get_file_contents('/Documents/m2-ui-network.json'))
                                check(appearance + '_current_run', data.get('run_id') == run_id)
                                return [path for path in data['requests'] if path.startswith('/api/media')]
                            await asyncio.sleep(1)
                            await snapshot('feed')
                            check(appearance + '_no_prefetch', await media_requests() == [])
                            await tap_word('prova')
                            text, _, _ = await snapshot('protected')
                            check(appearance + '_warning_before_content', 'avviso storia sintetica' in text and 'testo storia sintetica' not in text)
                            check(appearance + '_no_media_before_consent', await media_requests() == [])
                            await tap_word('mostra')
                            await asyncio.sleep(.5)
                            text, _, _ = await snapshot('revealed')
                            check(appearance + '_revealed_body', 'testo storia sintetica' in text)
                            check(appearance + '_single_media_read', len(await media_requests()) == 1)
                            await tap_word('nascondi')
                            text, _, _ = await snapshot('hidden')
                            check(appearance + '_hidden_again', 'testo storia sintetica' not in text and 'mostra storia' in text)
                            await tap_word('mostra')
                            await asyncio.sleep(6)
                            text, _, _ = await snapshot('after-timer')
                            assisted = 'avanza con i pulsanti' in text
                            check(appearance + '_advance_or_voiceover_pause', 'avviso seconda storia' in text or assisted)
                            paths = await media_requests()
                            check(appearance + '_no_next_warning_prefetch', not any('story-2' in path for path in paths))
                            async with AccessibilityAudit(rsd) as ax:
                                original_size = next(s.value for s in await ax.settings() if s.key == 'DYNAMIC_TYPE')
                                try:
                                    actual = await set_dynamic_type(ax, 1.0)
                                    check(appearance + '_maximum_text_applied', actual == 1.0)
                                    await snapshot('maximum-text')
                                finally:
                                    restored = await set_dynamic_type(ax, original_size)
                                    check(appearance + '_text_restored', abs(restored - original_size) < .001)
                    report['status'] = 'passed'
                finally:
                    try:
                        await config.set_user_interface_style(original_style)
                        report['settings_restored'] = True
                    finally:
                        try:
                            async with AppServiceService(rsd) as apps:
                                await apps.launch_application(bundle)
                            report['normal_launch_restored'] = True
                        finally:
                            if not report['settings_restored'] or not report['normal_launch_restored']:
                                report['status'] = 'failed'
                            (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--appearance', nargs='+', choices=['dark', 'light'], default=['dark', 'light'])
    parser.add_argument('--output', type=Path, default=Path('.impeccable/review/m2-player'))
    asyncio.run(run(parser.parse_args()))
