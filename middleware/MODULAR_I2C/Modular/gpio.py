import smbus

DEV_PCF_ADDRS = 0x20

i2c_device = None

debug = False

conf_GPIO = [0,1,2,3,4,5,6,8,9,10,11,12,13,14]

def read_gpio_all(_i2c_address=DEV_PCF_ADDRS, device_bus=1):
    for i in range(5):
        try:
            data_pin= [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
            i2c_device = smbus.SMBus(device_bus)
            
            #pull-up
            for gpio_num in conf_GPIO:
                data_read = i2c_device.read_word_data(_i2c_address, 0)
                data_write = data_read | (0x01 << gpio_num)
                data_b = data_write.to_bytes(2, byteorder='little')
                i2c_device.write_byte_data(_i2c_address, data_b[0], data_b[1])

            ## read corespond device
            data = i2c_device.read_word_data(_i2c_address, 0)
            i2c_device.close()
            

            for gpio_num in range(len(conf_GPIO)):
                if (data & (0x01 << conf_GPIO[gpio_num])):
                    if debug:
                        print("gpio: " + str(conf_GPIO[gpio_num]) + ", data: true" )
                    data_pin[gpio_num] = True
                else:
                    if debug:
                        print("gpio: " + str(conf_GPIO[gpio_num]) + ", data: false")
                    data_pin[gpio_num] = False
            #
            return data_pin, "Succes"
            
        except Exception as e:
            print(e)
            print("Error in " + str(i) + " time trying")
            pass



def read_gpio_num(gpio_num, _i2c_address=DEV_PCF_ADDRS, device_bus=1):
    try: 
        i2c_device = smbus.SMBus(device_bus)
        #
        if gpio_num < 1 or gpio_num > 14:
            raise ValueError("Invalid GPIO, GPIO must be in 1-14 range")
        # read corespond device
        data = i2c_device.read_word_data(_i2c_address, 0)
        #
        i2c_device.close()
        #
        gpio_num = gpio_num-1
        if (data & (0x01 << conf_GPIO[gpio_num])):
            return 1, "Succes"
        else:
            return 0, "Succes"
    except Exception as e:
        print(e)
        return 0, "Failed"


def write_gpio_num(gpio_num, data,  _i2c_address=DEV_PCF_ADDRS, device_bus=1):
    for i in range(5):
        try:
            i2c_device = smbus.SMBus(device_bus)
            #
            if gpio_num < 1 or gpio_num > 14:
                raise ValueError("Invalid GPIO, GPIO must be in 1-14 range")
            # read corespond device
            data_read = i2c_device.read_word_data(_i2c_address, 0)
            #
            gpio_num = gpio_num-1
            if data:
                data_write = data_read | (0x01 << conf_GPIO[gpio_num])
            else:
                data_write = data_read & (~(0x01 << conf_GPIO[gpio_num]))
            #
            data_b = data_write.to_bytes(2, byteorder='little')
            i2c_device.write_byte_data(_i2c_address, data_b[0], data_b[1])
            #
            i2c_device.close()
            return "Succes"
        except Exception as e:
            print(e)
            print("Error in " + str(i) + " time trying")
            pass

