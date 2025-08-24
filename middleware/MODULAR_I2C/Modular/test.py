import smbus
import time

bus = smbus.SMBus(0)

print(bus.read_byte(0x20))
bus.write_byte(0x20, 0xfe)
print(bus.read_byte(0x20))