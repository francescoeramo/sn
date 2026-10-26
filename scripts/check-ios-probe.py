#!/usr/bin/env python3
"""Run SN's internal DEBUG diagnostics. No AX, HID, screenshots or photo-library access."""
import argparse
import asyncio
import json
import re
import time
import uuid
from pathlib import Path

from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.remote.userspace_tunnel import UserspaceRsdTunnel
from pymobiledevice3.remote.core_device.app_service import AppServiceService
from pymobiledevice3.services.house_arrest import HouseArrestService
from pymobiledevice3.services.installation_proxy import InstallationProxyService


async def run(args):
    run_id = str(uuid.uuid4())
    summary = {'status': 'failed', 'scope': 'SN internal synthetic diagnostics only', 'checks': []}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    async with await create_using_usbmux() as lockdown:
        async with InstallationProxyService(lockdown) as installed:
            apps = await installed.get_apps()
        candidates = [bundle for bundle in apps if bundle == 'it.sn.app' or bundle.endswith('.it.sn.app')]
        if len(candidates) != 1:
            raise SystemExit('Serve una sola build SN installata sul dispositivo USB.')
        bundle = candidates[0]
        async with UserspaceRsdTunnel() as rsd:
            try:
                async with AppServiceService(rsd) as service:
                    await service.launch_application(bundle, environment={
                        'SN_RUN_M1_CHECKS': '1', 'SN_M1_UI_FIXTURE': '1', 'SN_M1_CHECK_RUN_ID': run_id})
                # DEBUG container access; read only this fixed synthetic report, never enumerate files.
                async with await HouseArrestService.create(lockdown, bundle) as files:
                    deadline = time.monotonic() + 90
                    while time.monotonic() < deadline:
                        try:
                            raw = await files.get_file_contents('/Documents/m1-device-checks.json')
                            report = json.loads(raw)
                        except Exception:
                            # The app may still be creating its protected, synthetic report.
                            await asyncio.sleep(1)
                            continue
                        if report.get('run_id') != run_id:
                            await asyncio.sleep(1)
                            continue
                        if report.get('platform') != 'ios-device' or report.get('real_user_data') is not False:
                            raise ValueError('Unexpected diagnostic report')
                        checks = report.get('checks', [])
                        if not checks or any(not isinstance(check, dict)
                                             or not re.fullmatch('[A-Za-z0-9_]{1,100}', check.get('name', ''))
                                             or type(check.get('passed')) is not bool for check in checks):
                            raise ValueError('Unexpected checks schema')
                        summary['checks'] = [{'name': check['name'], 'passed': check['passed']} for check in checks]
                        names = {check['name'] for check in checks}
                        required = {'isolated_keychain_update_preserves_mfa', 'isolated_keychain_rotation_clears_pending_mfa'}
                        summary['status'] = 'passed' if required <= names and all(check['passed'] for check in checks) else 'failed'
                        break
                    else:
                        summary['status'] = 'timed_out'
            finally:
                try:
                    async with AppServiceService(rsd) as service:
                        await service.launch_application(bundle)
                    summary['normal_launch_restored'] = True
                except Exception:
                    summary['normal_launch_restored'] = False
                    summary['status'] = 'failed'
                args.output.write_text(json.dumps(summary, indent=2) + '\n')
    print('iPhone: ' + summary['status'] + ' · ' + str(len(summary['checks'])) + ' controlli interni', flush=True)
    if summary['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('.impeccable/review/m1-probe/report.json'))
    asyncio.run(run(parser.parse_args()))
