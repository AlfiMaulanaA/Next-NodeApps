from multiprocessing.util import ForkAwareThreadLock
import smbus

DEV_PCF_ADDRS = 0x20

i2c_device = None

debug = False

confinput_GPIO = [0,1,2,3,4,5,6,8,9,10,11,12,13,14]

def read_gpio_all(_i2c_address=DEV_PCF_ADDRS, device_bus=1):
    for i in range(5):
        try:
            data_pin= [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
            i2c_device = smbus.SMBus(device_bus)
            
            #pull-up
            for gpio_num in confinput_GPIO:
                data_read = i2c_device.read_word_data(_i2c_address, 0)
                data_write = data_read | (0x01 << gpio_num)
                data_b = data_write.to_bytes(2, byteorder='little')
                i2c_device.write_byte_data(_i2c_address, data_b[0], data_b[1])

            ## read corespond device
            data = i2c_device.read_word_data(_i2c_address, 0)
            i2c_device.close()
            

            for gpio_num in range(len(confinput_GPIO)):
                if (data & (0x01 << confinput_GPIO[gpio_num])):
                    if debug:
                        print("gpio: " + str(confinput_GPIO[gpio_num]) + ", data: true" )
                    data_pin[gpio_num] = False
                else:
                    if debug:
                        print("gpio: " + str(confinput_GPIO[gpio_num]) + ", data: false")
                    data_pin[gpio_num] = True
            #
            return data_pin, "Succes"
            
        except Exception as e:
            print(e)
            print("Error in " + str(i) + " time trying")
            pass
