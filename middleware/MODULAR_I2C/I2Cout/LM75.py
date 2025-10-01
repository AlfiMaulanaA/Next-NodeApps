import smbus
LM75_ADDRESS = 0x48
LM75_TEMP_REGISTER = 0
LM75_CONF_REGISTER = 1
LM75_THYST_REGISTER = 2
LM75_TOS_REGISTER = 3
LM75_CONF_SHUTDOWN = 0
LM75_CONF_OS_COMP_INT = 1
LM75_CONF_OS_POL = 2
LM75_CONF_OS_F_QUE = 3

def get_data(address=LM75_ADDRESS, device_bus=0, mode=LM75_CONF_OS_COMP_INT):
    try:
        data =[]
        device = smbus.SMBus(device_bus)
        raw = device.read_word_data(address, LM75_TEMP_REGISTER) & 0xFFFF
        raw = ((raw << 8) & 0xFF00) + (raw >> 8)
        # Get temperarture in chelcius
        temp = (raw / 32.0) / 8.0
        data.append(temp)
        return data , "Succes"
    except Exception as e:
        print(e)
        return "Failed", "Failed"