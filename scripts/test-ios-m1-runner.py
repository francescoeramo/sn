"""Offline contract checks: the M1 runner orders gates, install and device work safely."""
import contextlib
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ios_m1', Path(__file__).with_name('check-ios-m1.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class M1RunnerTests(unittest.TestCase):
    def invoke(self, arguments, failing=None):
        calls = []
        def execute(command, **kwargs):
            calls.append(command)
            return subprocess.CompletedProcess(command, 1 if failing and failing in command else 0)
        with tempfile.TemporaryDirectory() as directory:
            script = Path(directory) / 'scripts' / 'check-ios-m1.py'
            with patch.object(runner, '__file__', str(script)), patch.object(sys, 'argv', ['runner', *arguments]), \
                    patch.object(runner, 'execute', side_effect=execute), contextlib.redirect_stdout(io.StringIO()):
                code = runner.main()
            report = json.loads(next(Path(directory).glob('.impeccable/review/*/report.json')).read_text())
        return code, calls, report

    def test_timeout_stops_child_processes(self):
        with tempfile.TemporaryDirectory() as directory:
            pidfile = Path(directory) / "child.pid"
            child = ("import signal,time,pathlib,os,sys; signal.signal(signal.SIGTERM,signal.SIG_IGN); "
                     "pathlib.Path(sys.argv[1]).write_text(str(os.getpid())); time.sleep(30)")
            script = ("import subprocess,sys,time; "
                      "subprocess.Popen([sys.executable,'-c',sys.argv[2],sys.argv[1]]); time.sleep(30)")
            with (Path(directory) / "log").open("w") as stream:
                with self.assertRaises(subprocess.TimeoutExpired):
                    runner.execute([sys.executable, "-c", script, str(pidfile), child], directory, stream, timeout=1)
            self.assertTrue(pidfile.exists(), "The test must actually start a child")
            state = Path("/proc") / pidfile.read_text() / "stat"
            for _ in range(50):
                if not state.exists() or state.read_text().split()[2] == "Z":
                    break
                time.sleep(.01)
            self.assertTrue(not state.exists() or state.read_text().split()[2] == "Z",
                            "A timed-out gate must not keep its child alive")

    def test_default_runs_local_checks_without_install_or_device(self):
        code, calls, report = self.invoke([])
        self.assertEqual(code, 0)
        self.assertIn('device-settings-contract', [check['name'] for check in report['checks']])
        self.assertEqual(report['installation'], 'not_run')
        self.assertEqual(report['device'], 'not_run')
        self.assertEqual(report['auth_ui'], 'not_run')
        self.assertFalse(any('scripts/prepare-ios-dev.py' in call for call in calls))

    def test_install_is_after_build_and_before_internal_probe_and_auth_ui(self):
        code, calls, report = self.invoke(['--install-interface', 'usb-fixture', '--probe', '--auth-ui'])
        self.assertEqual(code, 0)
        names = [check['name'] for check in report['checks']]
        self.assertLess(names.index('darwin-build'), names.index('usb-install'))
        self.assertLess(names.index('usb-install'), names.index('device-probe'))
        self.assertLess(names.index('device-probe'), names.index('auth-ui'))
        install = next(call for call in calls if 'scripts/prepare-ios-dev.py' in call)
        self.assertEqual(install[-3:], ['--interface', 'usb-fixture', '--install'])
        self.assertEqual(report['installation'], 'passed')
        self.assertEqual(report['auth_ui'], 'passed')
        auth_ui = next(call for call in calls if 'scripts/check-ios-auth-ui.py' in call)
        self.assertEqual(auth_ui[auth_ui.index('--screens') + 1:auth_ui.index('--output')],
                         ['login', 'mfa', 'storage', 'warning'])

    def test_failed_local_gate_prevents_install_and_device(self):
        code, calls, report = self.invoke(['--install-interface', 'usb-fixture', '--probe'], failing='typecheck')
        self.assertEqual(code, 1)
        self.assertEqual(report['status'], 'failed')
        self.assertFalse(any('scripts/prepare-ios-dev.py' in call for call in calls))

    def test_failed_install_prevents_device_launch(self):
        code, calls, report = self.invoke(['--install-interface', 'usb-fixture', '--probe'],
                                         failing='scripts/prepare-ios-dev.py')
        self.assertEqual(code, 1)
        self.assertEqual(report['status'], 'failed')
        self.assertFalse(any('scripts/check-ios-probe.py' in call for call in calls))


if __name__ == '__main__':
    unittest.main()
