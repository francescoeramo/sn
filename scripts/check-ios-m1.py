#!/usr/bin/env python3
"""Run the local M1 gates, optionally followed by the installed iPhone UI checks."""
import argparse
import json
import os
import signal
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path



def execute(command, cwd, stream, timeout=900):
    """A failed/timed-out gate must not leave compilers or device installers running."""
    process = subprocess.Popen(command, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT,
                               start_new_session=True)
    try:
        code = process.wait(timeout=timeout)
        return subprocess.CompletedProcess(command, code)
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
        # The parent may exit before a descendant that ignores SIGTERM.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
        raise

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    device = parser.add_mutually_exclusive_group()
    device.add_argument('--device-bundle', help='Also exercise the installed DEBUG app with this signed bundle ID')
    device.add_argument('--probe', action='store_true', help='Run internal iPhone diagnostics without UI automation')
    parser.add_argument('--install-interface', help='After local gates, prepare and install using only this interface')
    parser.add_argument('--auth-ui', action='store_true', help='Capture synthetic login/MFA screens on the installed iPhone')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = root / '.impeccable/review' / ('m1-check-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    output.mkdir(parents=True)
    report = {'status': 'running', 'checks': [], 'scope': 'Local synthetic tests; no cloud writes',
              'device': 'requested' if args.device_bundle or args.probe else 'not_run',
              'installation': 'requested' if args.install_interface else 'not_run',
              'auth_ui': 'requested' if args.auth_ui else 'not_run'}
    report_path = output / 'report.json'

    def save():
        report_path.write_text(json.dumps(report, indent=2) + '\n')

    def run(name, command, cwd=root):
        log = output / (name + '.log')
        result = {'name': name, 'status': 'running', 'log': str(log.relative_to(root))}
        report['checks'].append(result)
        save()
        print(name + '…', flush=True)
        try:
            with log.open('w') as stream:
                process = execute(command, cwd=cwd, stream=stream)
            result['status'] = 'passed' if process.returncode == 0 else 'failed'
            result['exit_code'] = process.returncode
        except OSError as error:
            log.write_text(str(error) + '\n')
            result['status'] = 'unavailable'
        except subprocess.TimeoutExpired:
            result['status'] = 'timed_out'
        except KeyboardInterrupt:
            result['status'] = 'interrupted'
            save()
            raise
        save()
        print(name + ': ' + result['status'], flush=True)
        if result['status'] != 'passed':
            raise RuntimeError(name)

    try:
        run('runner-contract', [sys.executable, '-B', 'scripts/test-ios-m1-runner.py'])
        run('development-network', [sys.executable, '-B', 'scripts/test-ios-dev.py'])
        run('session', ['bash', 'scripts/check-ios-session.sh'])
        with tempfile.TemporaryDirectory(prefix='sn-m1-contract-') as temporary:
            executable = str(Path(temporary) / 'models')
            run('models-compile', ['swiftc', '-module-cache-path', str(Path(temporary) / 'cache'),
                                  'ios/SN/Models/Session.swift', 'ios/SN/Models/Feed.swift',
                                  'ios/ContractChecks/main.swift', '-o', executable])
            run('models', [executable])
        run('server', ['npm', 'test', '--', 'tests/native-social.test.ts',
                       'tests/native-auth.test.ts', 'tests/security-api.test.ts', 'tests/rules.test.ts'])
        run('typecheck', ['npm', 'run', 'typecheck'])
        run('lint', ['npm', 'run', 'lint'])
        run('darwin-build', ['xtool', 'dev', 'build'], cwd=root / 'ios')
        if args.install_interface:
            run('usb-install', [sys.executable, 'scripts/prepare-ios-dev.py',
                                '--interface', args.install_interface, '--install'])
            report['installation'] = 'passed'
        if args.device_bundle:
            run('device', [sys.executable, 'scripts/check-ios-m1-device.py', '--bundle',
                           args.device_bundle, '--output', str(output / 'device')])
            report['device'] = 'passed'
        elif args.probe:
            run('device-probe', [sys.executable, 'scripts/check-ios-probe.py', '--output', str(output / 'device-probe.json')])
            report['device'] = 'passed'
        if args.auth_ui:
            run('auth-ui', [sys.executable, 'scripts/check-ios-auth-ui.py',
                            '--screens', 'login', 'mfa', 'storage', '--output', str(output / 'auth-ui')])
            report['auth_ui'] = 'passed'
        report['status'] = 'passed'
    except (RuntimeError, KeyboardInterrupt):
        report['status'] = 'failed'
    finally:
        save()
        print('M1: ' + report['status'] + ' · ' + str(report_path.relative_to(root)), flush=True)
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
