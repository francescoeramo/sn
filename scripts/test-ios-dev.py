"""Offline regressions for LAN selection and the narrowly scoped plist update."""
import importlib.util
import plistlib
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('ios_dev', Path(__file__).with_name('prepare-ios-dev.py'))
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)


class DevelopmentNetworkTests(unittest.TestCase):
    def interfaces(self, *hosts):
        return [{'ifname': 'wifi', 'flags': ['UP'], 'addr_info': [{'local': host} for host in hosts]}]

    def test_dhcp_change_selects_the_only_private_default_interface(self):
        self.assertEqual(dev.select_host('192.168.1.9', self.interfaces('192.168.1.251'),
                                       [{'dst': 'default', 'dev': 'wifi'}]), '192.168.1.251')

    def test_existing_host_wins_and_explicit_host_must_be_assigned(self):
        self.assertEqual(dev.select_host('192.168.1.9', self.interfaces('192.168.1.9'), []), '192.168.1.9')
        with self.assertRaises(ValueError):
            dev.select_host('192.168.1.9', self.interfaces('192.168.1.9'), [], '192.168.1.2')

    def test_public_loopback_and_ambiguous_routes_are_rejected(self):
        for hosts in [('8.8.8.8',), ('127.0.0.1',), ('192.168.1.2', '192.168.1.3')]:
            with self.assertRaises(ValueError):
                dev.select_host('missing', self.interfaces(*hosts), [{'dst': 'default', 'dev': 'wifi'}])

    def test_interface_constraint_overrides_configured_wifi(self):
        interfaces = self.interfaces('192.168.1.9') + [
            {'ifname': 'usb', 'flags': ['UP'], 'addr_info': [{'local': '172.20.10.3'}]}]
        routes = [{'dst': 'default', 'dev': 'wifi'}, {'dst': 'default', 'dev': 'usb'}]
        self.assertEqual(dev.select_host('192.168.1.9', interfaces, routes, device='usb'), '172.20.10.3')
        with self.assertRaises(ValueError):
            dev.select_host('192.168.1.9', interfaces, routes, explicit='192.168.1.9', device='usb')

    def test_missing_or_down_interface_never_falls_back_to_wifi(self):
        for extra in [[], [{'ifname': 'usb', 'flags': [], 'addr_info': [{'local': '172.20.10.3'}]}]]:
            with self.assertRaises(ValueError):
                dev.select_host('192.168.1.9', self.interfaces('192.168.1.9') + extra,
                                [{'dst': 'default', 'dev': 'wifi'}], device='usb')

    def test_update_changes_only_endpoint_and_its_ats_exception(self):
        original = (Path(__file__).resolve().parent.parent / 'ios/SN/Info.plist').read_text()
        old = plistlib.loads(original.encode())['SNApiBaseURL'].split('/')[2].split(':')[0]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'Info.plist'
            path.write_text(original)
            self.assertTrue(dev.update_config(path, '192.168.1.200'))
            self.assertEqual(path.read_text(), original.replace(old, '192.168.1.200'))
            self.assertFalse(dev.update_config(path, '192.168.1.200'))

    def test_https_configuration_is_never_downgraded(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'Info.plist'
            original = plistlib.dumps({'SNApiBaseURL': 'https://sn.example'})
            path.write_bytes(original)
            with self.assertRaises(ValueError):
                dev.update_config(path, '192.168.1.2')
            self.assertEqual(path.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
