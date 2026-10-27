#!/usr/bin/env python3
"""Capture only SN's synthetic login/MFA screens. No AX traversal, input or gallery."""
import argparse
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
from pymobiledevice3.services.accessibilityaudit import AccessibilityAudit
from pymobiledevice3.services.installation_proxy import InstallationProxyService


async def run(args):
    args.output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'failed', 'scope': 'Synthetic SN auth screens; no input or AX traversal',
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
                for screen in ('login', 'mfa'):
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
                            expected = 'accesso' in text if screen == 'login' else 'mfa' in text
                            if 'collaudo' in text and expected:
                                break
                        else:
                            if 'collaudo' in text:
                                (args.output / 'unexpected-fixture.png').write_bytes(data)
                            report['checks'].append({'screen': screen, 'appearance': appearance, 'passed': False,
                                                       'fixture_marker_seen': 'collaudo' in text, 'screen_label_seen': expected})
                            raise ValueError('Schermata fixture non confermata; nessuna immagine salvata.')
                        (args.output / (screen + '-' + appearance + '.png')).write_bytes(data)
                        report['checks'].append({'screen': screen, 'appearance': appearance, 'passed': True})
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
    print('UI accesso iPhone: ' + report['status'] + ' · ' + str(len(report['checks'])) + ' schermate sintetiche')
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('.impeccable/review/auth-ui'))
    raise SystemExit(asyncio.run(run(parser.parse_args())))
