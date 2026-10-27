#!/usr/bin/env python3
"""Check synthetic SN states. Input only on confirmed local warning controls; no AX traversal/gallery."""
import argparse
import csv
import io
import struct
import asyncio
import json
import subprocess
import time
from pathlib import Path

from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.remote.userspace_tunnel import UserspaceRsdTunnel
from pymobiledevice3.remote.core_device.app_service import AppServiceService
from pymobiledevice3.remote.core_device.configuration_service import ConfigurationService
from pymobiledevice3.remote.core_device.screen_capture_service import ScreenCaptureService
from pymobiledevice3.remote.core_device.hid_service import (
    touch_session, TOUCHSCREEN_STATE_CONTACT, TOUCHSCREEN_STATE_RELEASE,
)
from pymobiledevice3.services.accessibilityaudit import AccessibilityAudit
from pymobiledevice3.services.installation_proxy import InstallationProxyService


def fixture_visible(text):
    text = ' '.join(text.casefold().split())
    return 'collaudo m1' in text and 'dati locali' in text


async def warning_actions(rsd, output, appearance, report):
    async with touch_session(rsd) as hid:
        for action, visible in [('mostra', True), ('nascondi', False)]:
            async with ScreenCaptureService(rsd) as capture:
                data = (await capture.capture_screenshot())['image']
            ocr = subprocess.run(['tesseract', 'stdin', 'stdout'], input=data,
                                 capture_output=True, check=True, timeout=10)
            text = ' '.join(ocr.stdout.decode().casefold().split())
            if not fixture_visible(text) or 'avviso di collaudo' not in text:
                raise ValueError('Fixture avviso non confermata: nessun tocco eseguito.')
            tsv = subprocess.run(['tesseract', 'stdin', 'stdout', 'tsv'], input=data,
                                 capture_output=True, check=True, timeout=10)
            words = list(csv.DictReader(io.StringIO(tsv.stdout.decode()), delimiter='	'))
            targets = [word for word in words if word['text'].strip().casefold() == action]
            if len(targets) != 1:
                raise ValueError('Comando avviso non univoco: nessun tocco eseguito.')
            target = targets[0]
            width, height = struct.unpack('>II', data[16:24])
            x = round((int(target['left']) + int(target['width']) / 2) * 65535 / width)
            y = round((int(target['top']) + int(target['height']) / 2) * 65535 / height)
            await hid.send_touchscreen(TOUCHSCREEN_STATE_CONTACT, x, y)
            await asyncio.sleep(.05)
            await hid.send_touchscreen(TOUCHSCREEN_STATE_RELEASE, x, y)
            await asyncio.sleep(.5)
            async with ScreenCaptureService(rsd) as capture:
                data = (await capture.capture_screenshot())['image']
            ocr = subprocess.run(['tesseract', 'stdin', 'stdout'], input=data,
                                 capture_output=True, check=True, timeout=10)
            text = ' '.join(ocr.stdout.decode().casefold().split())
            actual_visible = 'testo sotto avviso' in text
            correct = fixture_visible(text) and actual_visible == visible
            report['checks'].append({'screen': 'warning', 'appearance': appearance,
                                     'action': action, 'content_visible': actual_visible, 'passed': correct})
            if not correct:
                raise ValueError('Stato avviso non confermato; nessuna immagine salvata.')
            (output / ('warning-' + appearance + '-' + action + '.png')).write_bytes(data)


async def run(args):
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'failed', 'scope': 'Synthetic SN screens; input only on local warning controls; no AX traversal',
              'checks': [], 'normal_launch_restored': False, 'settings_restored': False}
    async with await create_using_usbmux() as lockdown:
        async with InstallationProxyService(lockdown) as installed:
            apps = await installed.get_apps()
        candidates = [bundle for bundle in apps if bundle == 'it.sn.app' or bundle.endswith('.it.sn.app')]
        if len(candidates) != 1:
            raise ValueError('Serve una sola build SN DEBUG sul dispositivo USB.')
        bundle = candidates[0]
    async with UserspaceRsdTunnel() as rsd:
        async with ConfigurationService(rsd) as config:
            style = await config.get_user_interface_style()
            async with AccessibilityAudit(rsd) as ax:
                size = next(setting.value for setting in await ax.settings() if setting.key == 'DYNAMIC_TYPE')
            try:
                for screen in args.screens:
                    for appearance in ('dark', 'light'):
                        await config.set_user_interface_style(appearance)
                        async with AppServiceService(rsd) as service:
                            await service.launch_application(bundle, environment={
                                'SN_M1_UI_FIXTURE': '1', 'SN_M1_FIXTURE_SCREEN': screen})
                        deadline = time.monotonic() + 20
                        while time.monotonic() < deadline:
                            await asyncio.sleep(1)
                            async with ScreenCaptureService(rsd) as capture:
                                data = (await capture.capture_screenshot())['image']
                            ocr = subprocess.run(['tesseract', 'stdin', 'stdout'], input=data,
                                                 capture_output=True, check=True, timeout=10)
                            text = ocr.stdout.decode().casefold()
                            expected = {'login': 'accesso', 'mfa': 'mfa', 'storage': 'salvataggio', 'warning': 'avviso'}[screen] in text
                            if fixture_visible(text) and expected:
                                break
                        else:
                            if fixture_visible(text):
                                (args.output / 'unexpected-fixture.png').write_bytes(data)
                            report['checks'].append({'screen': screen, 'appearance': appearance, 'passed': False,
                                                       'fixture_marker_seen': fixture_visible(text), 'screen_label_seen': expected})
                            raise ValueError('Schermata fixture non confermata; nessuna immagine salvata.')
                        (args.output / (screen + '-' + appearance + '.png')).write_bytes(data)
                        report['checks'].append({'screen': screen, 'appearance': appearance, 'passed': True})
                        if screen == 'warning':
                            if 'testo sotto avviso' in ' '.join(text.split()):
                                raise ValueError('Il contenuto deve essere nascosto all’avvio.')
                            await warning_actions(rsd, args.output, appearance, report)
                report['status'] = 'passed'
            finally:
                try:
                    await config.set_user_interface_style(style)
                    async with AccessibilityAudit(rsd) as ax:
                        await ax.set_setting('DYNAMIC_TYPE', size)
                    report['settings_restored'] = True
                finally:
                    try:
                        async with AppServiceService(rsd) as service:
                            await service.launch_application(bundle)
                        report['normal_launch_restored'] = True
                    finally:
                        if not report['normal_launch_restored'] or not report['settings_restored']:
                            report['status'] = 'failed'
                        (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print('UI SN iPhone: ' + report['status'] + ' · ' + str(len(report['checks'])) + ' schermate sintetiche')
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--screens', nargs='+', choices=['login', 'mfa', 'storage', 'warning'], default=['login', 'mfa'])
    parser.add_argument('--output', type=Path, default=Path('.impeccable/review/auth-ui'))
    raise SystemExit(asyncio.run(run(parser.parse_args())))
