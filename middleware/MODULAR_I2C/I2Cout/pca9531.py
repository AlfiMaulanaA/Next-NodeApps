import smbus
PCA9531_ADDRESS = 0x60


def set_data(data, address=PCA9531_ADDRESS, device_bus=0):
    try:
        device = smbus.SMBus(device_bus)
        # SET Prescale frequency to 0
        device.write_byte_data(address, 0x01, 0x00)
        # SET PWM duty cycle
        value = data/100 * 255
        device.write_byte_data(0x60, 0x05, hex(value))
      
        return "Succes"
    except Exception as e:
        print(e)
        return "Failed"