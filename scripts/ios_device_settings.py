"""Bounded Dynamic Type control using the device's actual setting metadata."""
import asyncio


async def set_dynamic_type(ax, value):
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not 0 <= value <= 1:
        raise ValueError('Dynamic Type must be a slider value between 0 and 1.')
    setting = next(item for item in await ax.settings() if item.key == 'DYNAMIC_TYPE')
    # pymobiledevice3's generic setter hardcodes type 3 (boolean). On this device
    # Dynamic Type is type 2, with twelve ticks. Preserve the metadata we read.
    fields = setting._fields
    required = ('IdentiifierValue_v1', 'CurrentValueNumber_v1', 'EnabledValue_v1',
                'SettingTypeValue_v1', 'SliderTickMarksValue_v1')
    serialized = {'ObjectType': 'AXAuditDeviceSetting_v1', 'Value': {
        'ObjectType': 'passthrough', 'Value': {
            key: {'ObjectType': 'passthrough', 'Value': fields[key]} for key in required
        }}}
    await ax._invoke('deviceUpdateAccessibilitySetting:withValue:', serialized,
                     {'ObjectType': 'passthrough', 'Value': value}, expects_reply=False)
    # Keep the connection alive and verify application, including restoration.
    for _ in range(10):
        await asyncio.sleep(.1)
        actual = next(item.value for item in await ax.settings() if item.key == 'DYNAMIC_TYPE')
        if abs(actual - value) < .001:
            return actual
    raise RuntimeError('The device did not apply the requested Dynamic Type value.')
