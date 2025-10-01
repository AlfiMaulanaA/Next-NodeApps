# !python3
# cython: language_level=3
import Protocols.i2c_modular as i2c_modular

# Addr AD5593
_i2c_address            = 0x11
# Define address
_ADAC_NULL              = 0x00
_ADAC_DAC_READBACK      = 0x01
_ADAC_ADC_SEQUENCE      = 0x02
_ADAC_GP_CONTROL        = 0x03
_ADAC_ADC_CONFIG        = 0x04
_ADAC_DAC_CONFIG        = 0x05
_ADAC_PULL_DOWN         = 0x06
_ADAC_LDAC_MODE         = 0x07
_ADAC_GPIO_WR_CONFIG    = 0x08
_ADAC_GPIO_WR_DATA      = 0x09
_ADAC_GPIO_RD_CONFIG    = 0x0A
_ADAC_POWER_REF_CTRL    = 0x0B
_ADAC_OPEN_DRAIN_CFG    = 0x0C
_ADAC_THREE_STATE       = 0x0D
_ADAC_RESERVED          = 0x0E
_ADAC_SOFT_RESET        = 0x0F
# ADAC Configuration Data Bytes
# write into MSB after _ADAC_POWER_REF_CTRL command to enable VREF
_ADAC_VREF_ON           = 0x02
_ADAC_SEQUENCE_ON       = 0x02
# ADAC Write / Read Pointer Bytes
_ADAC_DAC_WRITE         = 0x10
_ADAC_ADC_READ          = 0x40
_ADAC_DAC_READ          = 0x50
_ADAC_GPIO_READ         = 0x70
_ADAC_REG_READ          = 0x60
#parameter
_num_of_channels        = 8
# Value of the reference voltage, if none is specified then all ADC/DAC functions will throw errors
_Vref                   = -1
# flag for 2xVref mode
_ADC_2x_mode            = 0
# lag for 2xVref mode
_DAC_2x_mode            = 0
_ADC_max                = -1
_DAC_max                = -1

ADCs                    = [0]*_num_of_channels
DACs                    = [0]*_num_of_channels

config                  = [ADCs, DACs]
value                   = [ADCs, DACs]

_Vref                   = 2.5

_GPRC_msbs              = 0x00
_GPRC_lsbs              = 0x00
_PCR_msbs               = 0x00
_PCR_lsbs               = 0x00

_DAC_config             = 0x00
_ADC_config             = 0x00


for i in range(_num_of_channels):
    config[ADCs[i]]      = 0
    config[DACs[i]]      = 0

for i in range(_num_of_channels):
    value[ADCs[i]]       = -1
    value[ADCs[i]]       = -1



def enable_internal_Vref(device):
    global _PCR_msbs, _ADC_max, _DAC_max
    # enable internal voltage referensi. if you using rpi 4 panel this is default do not change    
    _ADC_max = _Vref
    _DAC_max = _Vref
    if (_PCR_msbs & 0x02) != 0x02:
        _PCR_msbs = _PCR_msbs ^ 0x02

    data = [_PCR_msbs, _PCR_lsbs]

    device.writeList(_ADAC_POWER_REF_CTRL, data)
   
def set_ADC_max_2x_Vref(device):
    global _GPRC_lsbs, _ADC_max
    # this will make max ADC is 2x Vref or 5V
    _ADC_max = 2*_Vref
    if (_GPRC_lsbs & 0x20) != 0x20:
        _GPRC_lsbs = _GPRC_lsbs ^ 0x20

    data = [_GPRC_msbs, _GPRC_lsbs]

    device.writeList(_ADAC_GP_CONTROL, data)

    _ADC_2x_mode = 1

def set_DAC_max_2x_Vref(device):
    global _GPRC_lsbs, _DAC_max
    # this will make max DAC is 2x Vref or 5V
    _DAC_max = 2*_Vref
    if (_GPRC_lsbs & 0x10) != 0x10:
        _GPRC_lsbs = _GPRC_lsbs ^ 0x10

    data = [_GPRC_msbs, _GPRC_lsbs]

    device.writeList(_ADAC_GP_CONTROL, data)

    _DAC_2x_mode = 1

def set_Vref(Vref = 2.5):
    global _Vref, _ADC_max
    _Vref = Vref
    if _ADC_2x_mode == 0:
        _ADC_max = Vref
    else:
        _ADC_max = 2 * Vref    
    if _DAC_2x_mode == 0:
        _DAC_max = Vref
    else:
        _DAC_max = 2 * Vref

def configure_DAC(device, channels):
    global _DAC_config
    # Configuration channel pin for DAC 
    if channels < 0 or channels > 7:
        raise ValueError("Invalid Channel range, Channel must be in 0-7 range")
    channel_byte = 1 << channels
    if (_DAC_config and channel_byte) != channel_byte:
        _DAC_config = _DAC_config ^ channel_byte

    data = [0x0, _DAC_config]

    device.writeList(_ADAC_DAC_CONFIG, data)

   
def configure_ADC(device, channels):
    global _ADC_config
    # Configuration channel pin for ADC
    if channels < 0 or channels > 7:
        raise ValueError("Invalid Channel range, Channel must be in 0-7 range")

    channel_byte = 1 << channels
    _ADC_config = _ADC_config ^ channel_byte
    data =  [0x0, _ADC_config]

    device.writeList(_ADAC_ADC_CONFIG, data)

def read_data_pin(channel, _i2c_address, device_bus):
    # reade data in selected pin
    try:
        device = i2c_modular.Device(_i2c_address, device_bus)  
        enable_internal_Vref(device)
        set_ADC_max_2x_Vref(device)
        for i in range(5):
            configure_ADC(device, channel)
            channel_byte        = 1 << channel
            data                = [0x02, channel_byte] 
            device.writeList(_ADAC_ADC_SEQUENCE, data)
        
            data = device.readList(_ADAC_ADC_READ, 2)
            #int_number = int.from_bytes(data, byteorder="big", signed=False)
            _data_bits = (data[0] & 0x0f) << 8
            _data_bits = _data_bits | data[1]

            data = _ADC_max*(_data_bits)/4095

        return data , "Succes"
    except Exception as e:
        print(e)
        return 0, "Failed"

def write_data_pin(_i2c_address, device_bus, channel, voltage):
    # Write data to pin selected
    try:
        device = i2c_modular.Device(_i2c_address, device_bus) 
        enable_internal_Vref(device)
        set_DAC_max_2x_Vref(device)
        configure_DAC(device, channel)
        if voltage > _DAC_max:
            raise ValueError("Vref or DAC Max is lower than voltage")

        data_bits       = int((voltage/_DAC_max)*4095)
        data_msbs       = (data_bits & 0xf00) >> 8
        lsbs            = (data_bits & 0x0ff)
        msbs            = (0x80 | (channel << 4)) | data_msbs
        data            = [msbs, lsbs]

        i2c_modular.device.writeList(_ADAC_DAC_WRITE | channel, data)

        value[DACs[channel]] = voltage
        return "Succes"
    except Exception as e:
        print(e)
        return "Failed"
