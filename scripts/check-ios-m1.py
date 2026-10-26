#!/usr/bin/env python3
"""Run the local M1 gates, optionally followed by the installed iPhone UI checks."""
import argparse
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device-bundle', help='Also exercise the installed DEBUG app with this signed bundle ID')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    output = root / '.impeccable/review' / ('m1-check-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    output.mkdir(parents=True)
    report = {'status': 'running', 'checks': [], 'scope': 'Local synthetic tests; no cloud writes',
              'device': 'requested' if args.device_bundle else 'not_run'}
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
                process = subprocess.run(command, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT,
                                         timeout=900)
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
        if args.device_bundle:
            run('device', [sys.executable, 'scripts/check-ios-m1-device.py', '--bundle',
                           args.device_bundle, '--output', str(output / 'device')])
            report['device'] = 'passed'
        report['status'] = 'passed'
    except (RuntimeError, KeyboardInterrupt):
        report['status'] = 'failed'
    finally:
        save()
        print('M1: ' + report['status'] + ' · ' + str(report_path.relative_to(root)), flush=True)
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
