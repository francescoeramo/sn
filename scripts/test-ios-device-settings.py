"""Offline regression: slider metadata must survive write and restoration."""
import unittest
from types import SimpleNamespace
from ios_device_settings import set_dynamic_type


class Device:
    def __init__(self, ignore=False):
        self.value = 3 / 11
        self.ignore = ignore
        self.writes = []

    async def settings(self):
        return [SimpleNamespace(key='DYNAMIC_TYPE', value=self.value, _fields={
            'IdentiifierValue_v1': 'DYNAMIC_TYPE', 'CurrentValueNumber_v1': self.value,
            'EnabledValue_v1': True, 'SettingTypeValue_v1': 2, 'SliderTickMarksValue_v1': 12})]

    async def _invoke(self, selector, setting, value, expects_reply):
        fields = setting['Value']['Value']
        self.writes.append((selector, fields))
        if fields['SettingTypeValue_v1']['Value'] == 2 and not self.ignore:
            self.value = value['Value']


class SettingsTests(unittest.IsolatedAsyncioTestCase):
    async def test_apply_and_restore_preserve_slider_type_and_ticks(self):
        device = Device()
        original = device.value
        self.assertEqual(await set_dynamic_type(device, 1), 1)
        self.assertAlmostEqual(await set_dynamic_type(device, original), original)
        self.assertEqual(len(device.writes), 2)
        for selector, fields in device.writes:
            self.assertEqual(selector, 'deviceUpdateAccessibilitySetting:withValue:')
            self.assertEqual(fields['SettingTypeValue_v1']['Value'], 2)
            self.assertEqual(fields['SliderTickMarksValue_v1']['Value'], 12)

    async def test_ignored_write_is_not_reported_as_applied(self):
        with self.assertRaises(RuntimeError):
            await set_dynamic_type(Device(ignore=True), 1)

    async def test_invalid_input_never_writes(self):
        device = Device()
        for value in (-1, 2, True, 'large'):
            with self.assertRaises(ValueError):
                await set_dynamic_type(device, value)
        self.assertFalse(device.writes)


if __name__ == '__main__':
    unittest.main()
