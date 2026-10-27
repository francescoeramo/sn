#!/usr/bin/env python3
"""Real iPhone M1 UI checks using an opt-in DEBUG fixture, CoreDevice HID and AX.
Run with the existing pymobiledevice3 venv. Requires unlocked portrait iPhone,
installed DEBUG build, and tesseract. No cloud writes or real token access.
Captures remain local; only the synthetic summary is suitable for committing.
"""
import argparse
import asyncio
import csv
import io
import json
import re
import struct
import subprocess
from pathlib import Path

from pymobiledevice3.remote.userspace_tunnel import UserspaceRsdTunnel
from pymobiledevice3.remote.core_device.app_service import AppServiceService
from pymobiledevice3.remote.core_device.configuration_service import ConfigurationService
from pymobiledevice3.remote.core_device.screen_capture_service import ScreenCaptureService
from pymobiledevice3.remote.core_device.hid_service import (
    touch_session, TOUCHSCREEN_STATE_CONTACT, TOUCHSCREEN_STATE_RELEASE,
)
from pymobiledevice3.services.accessibilityaudit import AccessibilityAudit

AUDITS = ['testTypeSufficientElementDescription', 'testTypeContrast',
          'testTypeHitRegion', 'testTypeTextClipped', 'testTypeTrait', 'testTypeDynamicText']


async def run(args):
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'platform': 'ios-device', 'input': 'CoreDevice HID',
              'data': '85 synthetic posts through URLSession/URLProtocol', 'checks': []}

    def check(name, passed, fatal=True, **details):
        report['checks'].append({'name': name, 'passed': bool(passed), **details})
        print(json.dumps(report['checks'][-1]), flush=True)
        if not passed and fatal:
            raise AssertionError(name)

    finished = False
    async with UserspaceRsdTunnel() as rsd:
        async with ConfigurationService(rsd) as config:
            original_style = await config.get_user_interface_style()
            async with AccessibilityAudit(rsd) as ax:
                original_size = next(x.value for x in await ax.settings() if x.key == 'DYNAMIC_TYPE')
            try:
                async with AppServiceService(rsd) as apps:
                    await apps.launch_application(args.bundle, environment={'SN_M1_UI_FIXTURE': '1'})
                await asyncio.sleep(1)

                async def snapshot():
                    async with AccessibilityAudit(rsd) as ax:
                        captions = [x.caption or '' async for x in ax.iter_elements()]
                    # Never capture an unrelated app or a real account into the test report.
                    check('fixture_banner_present', 'Collaudo M1 · dati locali' in captions)
                    return captions

                async def capture(name):
                    async with ScreenCaptureService(rsd) as screen:
                        image = (await screen.capture_screenshot())['image']
                    verification = subprocess.run(['tesseract', 'stdin', 'stdout'], input=image,
                                                  check=True, capture_output=True, timeout=10)
                    check(name + '_capture_fixture', all(marker in verification.stdout.lower() for marker in (b'collaudo m1', b'dati locali')))
                    path = args.output / (name + '.png')
                    path.write_bytes(image)
                    return path, struct.unpack('>II', image[16:24])

                async with touch_session(rsd) as hid:
                    async def tap(x, y):
                        await hid.send_touchscreen(TOUCHSCREEN_STATE_CONTACT, x, y)
                        await asyncio.sleep(.05)
                        await hid.send_touchscreen(TOUCHSCREEN_STATE_RELEASE, x, y)
                        await asyncio.sleep(.5)

                    async def more(name):
                        path, (width, height) = await capture(name)
                        result = subprocess.run(['tesseract', str(path), 'stdout', 'tsv'],
                                                check=True, capture_output=True, text=True)
                        words = list(csv.DictReader(io.StringIO(result.stdout), delimiter='\t'))
                        targets = [w for w in words if w['text'].strip().casefold() == 'carica']
                        check(name + '_visible_button', len(targets) == 1)
                        word = targets[0]
                        x = (int(word['left']) + int(word['width']) / 2) * 65535 / width
                        y = (int(word['top']) + int(word['height']) / 2) * 65535 / height
                        await tap(round(x), round(y))

                    async def guard_fixture():
                        # OCR verifies the visible local banner without moving AX focus/scroll.
                        await capture('audit_guard')

                    async def page(name, expected):
                        captions = await asyncio.wait_for(snapshot(), 90)
                        posts = {x for x in captions if re.fullmatch(r'Post collaudo \d{3}', x)}
                        check(name, len(posts) == expected, posts=len(posts))
                        return captions

                    if not args.audit_only:
                        await page('feed_first_page', 40)
                        await more('feed_load_second')
                        await page('feed_second_page', 80)
                        await more('feed_load_third')
                        captions = await page('feed_third_page', 85)
                        check('feed_terminal_ui', any(x.startswith('Sei in pari') for x in captions)
                              and not any(x.startswith('Carica i post precedenti') for x in captions))
                    # The tab target is read from the standard portrait iPhone tab bar.
                    await guard_fixture()
                    await tap(49151, 61000)
                    if not args.audit_only:
                        captions = await page('profile_first_page', 40)
                        check('profile_tab_selected', any(x.startswith('Profilo,') and 'Selected' in x for x in captions))
                    await guard_fixture()
                    if not args.audit_only:
                        await more('profile_load_second')
                        await page('profile_second_page', 80)
                        await more('profile_load_third')
                        captions = await page('profile_third_page', 85)
                        check('profile_terminal_ui', any(x.startswith('Hai caricato tutti i tuoi post') for x in captions)
                              and not any(x.startswith('Carica i post precedenti') for x in captions))

                    for style in ('dark', 'light'):
                        await guard_fixture()
                        await config.set_user_interface_style(style)
                        await asyncio.sleep(.5)
                        async with AccessibilityAudit(rsd) as ax:
                            issues = await asyncio.wait_for(ax.run_audit(AUDITS), 45)
                        check('profile_audit_' + style, len(issues) == 0, fatal=False, issues=[x.json() for x in issues])
                        await capture('profile_' + style)
                    await guard_fixture()
                    async with AccessibilityAudit(rsd) as ax:
                        await ax.set_setting('DYNAMIC_TYPE', 1.0)
                    await asyncio.sleep(.5)
                    async with AccessibilityAudit(rsd) as ax:
                        actual_size = next(x.value for x in await ax.settings() if x.key == 'DYNAMIC_TYPE')
                    # Never label a capture as maximum text when the OS ignored the setting.
                    check('maximum_dynamic_type_setting_applied', actual_size == 1.0, actual=actual_size)
                    async with AccessibilityAudit(rsd) as ax:
                        issues = await asyncio.wait_for(ax.run_audit(AUDITS), 45)
                    check('profile_audit_maximum_dynamic_type', len(issues) == 0, fatal=False, issues=[x.json() for x in issues])
                    await capture('profile_maximum_dynamic_type')
                    finished = True
            finally:
                async with AccessibilityAudit(rsd) as ax:
                    await ax.set_setting('DYNAMIC_TYPE', original_size)
                await config.set_user_interface_style(original_style)
                async with AppServiceService(rsd) as apps:
                    await apps.launch_application(args.bundle)  # Exit the fixture, preserve real Keychain.
                report['settings_restored'] = True
                report['status'] = 'passed' if finished and report['checks'] and all(c['passed'] for c in report['checks']) else 'failed'
                (args.output / 'ui-report.json').write_text(json.dumps(report, indent=2) + '\n')
    if report.get('status') != 'passed':
        raise AssertionError('M1 device checks failed; see ui-report.json')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-only', action='store_true', help='Repeat only audits after pagination already passed')
    parser.add_argument('--bundle', required=True, help='Actual signed SN bundle id; do not change xtool.yml')
    parser.add_argument('--output', type=Path, default=Path('.impeccable/review/m1-device'))
    asyncio.run(run(parser.parse_args()))
