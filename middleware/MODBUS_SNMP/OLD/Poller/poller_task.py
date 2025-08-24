import Protocols.snmp as MySNMP
import Protocols.modbus_rtu as MyModbusRTU
import Protocols.modbus_tcp as MyModbusTCP
from time import strftime, localtime
import time, os, traceback, pprint, psutil
import Poller.libs as libs
import Poller.data_mapper as data_mapper
from Poller import datapckgr_by_pn, datapckgr_by_nm


pp = pprint.PrettyPrinter(indent=4)
ParentFolder = os.path.abspath('..')

# Function to get current memory usage (only for development stage)
def get_process_memory():
    process = psutil.Process(os.getpid())
    return [process.memory_info().rss,process.memory_full_info().rss]

# Class for SNMP polling
class SNMP(object):
    def __init__(self, profile, protocol_setting):
        # Get equipment profile
        self.name = profile['name']
        self.device_type = profile['device_type']
        self.manufacturer = profile['manufacturer']
        self.part_number = profile['part_number']

        # Get equipment settings
        self.protocol = protocol_setting['protocol']
        self.ip_address = protocol_setting['ip_address']
        self.port = protocol_setting['port']
        self.snmp_version = protocol_setting['snmp_version']
        self.read_community = protocol_setting['read_community']

        self.data_lib = libs.get_device_data_lib(self.device_type, self.manufacturer, self.part_number, self.protocol)

        # DATA REGISTER MAPPING
        self.data_map = data_mapper.snmp_map(self.data_lib)


    def poll(self):
        try:
            tPoll0 = time.time()  # end polling time

            try:
                self.device = MySNMP.Device(self.ip_address, self.port, self.read_community, self.snmp_version, Timeout = 3)
                # print("Connected to ", self.name)
            except:
                tb = traceback.format_exc()
                print(tb)
                print("FAILED Connection to", self.name)

            self.raw_data = {}

            ### Read Numeric Variable in Table OID
            # print("NumVarTabData")
            for dtype in MySNMP.NUMERIC:
                # print(self.data_map[0][dtype])
                _data_map = self.data_map[0][dtype]
                if len(_data_map) != 0:
                    NumVarTabData = self.device.read_num_tab(_data_map[0], _data_map[1], _data_map[2], _data_map[3])
                    self.raw_data.update(NumVarTabData)
                    # print(NumVarTabData)

            ### Read String Variable in Table OID
            # print("StrVarTabData")
            for dtype in MySNMP.STRING:
                # print(self.data_map[1][dtype])
                _data_map = self.data_map[1][dtype]
                if len(_data_map) != 0:
                    StrVarTabData = self.device.read_string_tab(_data_map[0], _data_map[1], _data_map[2])
                    self.raw_data.update(StrVarTabData)
                    #print(StrVarTabData)

            ### Read Numeric Variable in regular OID
            # print("NumVarData")
            for dtype in MySNMP.NUMERIC:
                # print(self.data_map[2][dtype])
                _data_map = self.data_map[2][dtype]
                if len(_data_map) != 0:
                    NumVarData = self.device.read_num(_data_map[0], _data_map[1], _data_map[2])
                    self.raw_data.update(NumVarData)
                    #print(NumVarData)

            ### Read String Variable in regular OID
            # print("StrVarData")
            for dtype in MySNMP.STRING:
                # print(self.data_map[3][dtype])
                _data_map = self.data_map[3][dtype]
                if len(_data_map) != 0:
                    StrVarData = self.device.read_string(_data_map[0], _data_map[1])
                    self.raw_data.update(StrVarData)
                    #print(StrVarData)
            
            ### Read Special Function ALARM
            # print("AlarmData")
            for dtype in MySNMP.ALARM_SNMP:
            #    #print(self.data_map[4][dtype])
                _data_map = self.data_map[4][dtype]
                if len(_data_map) != 0:
                    AlarmData = self.device.read_alarm(_data_map[0], _data_map[1], _data_map[5])
                    self.raw_data.update(AlarmData)
                    #print(StrVarData)


            tPoll1 = time.time()  # end polling time

            PollingDuration = tPoll1 - tPoll0
            self.raw_data['PollingDuration'] = PollingDuration
            Timestamp = strftime("%Y-%m-%d %H:%M:%S", localtime())
            self.raw_data['Timestamp'] = Timestamp

            # Process Data manufacturer-part_number data
            if self.manufacturer + "_" + self.part_number in datapckgr_by_pn.MANU_PN_LIST:
                self.command = """global _device_pck_pn
_device_pck_pn = datapckgr_by_pn.%s_%s('%s')""" % (self.manufacturer, self.part_number, self.protocol)
                exec(self.command)
                self.data = _device_pck_pn.process_raw_data(self.raw_data)
            else:
                device_pck_pn = datapckgr_by_pn.Device(self.protocol)
                self.data = device_pck_pn.process_raw_data(self.raw_data)

            # Process Data by name data
            if self.name in datapckgr_by_nm.NAME_LIST:
                self.command = """global _device_pck_nm
_device_pck_nm = datapckgr_by_nm.%s()""" % (self.name)
                exec(self.command)
                self.data = _device_pck_nm.process_raw_data(self.data)
            else:
                device_pck_nm = datapckgr_by_nm.Device()
                self.data = device_pck_nm.process_raw_data(self.data)

            #pp.pprint(self.data)
            return self.data
        except:
            tb = traceback.format_exc()
            print(tb)
            return -1

# Class for ModbusTCPpolling
class ModbusTCP(object):
    def __init__(self, profile, protocol_setting):
        # Get equipment profile
        self.name = profile['name']
        self.device_type = profile['device_type']
        self.manufacturer = profile['manufacturer']
        self.part_number = profile['part_number']

        # Get equipment settings
        self.protocol = protocol_setting['protocol']
        self.ip_address = protocol_setting['ip_address']
        self.port = protocol_setting['port']
        self.endianness = protocol_setting['endianness']
        self.timeout = protocol_setting['timeout']

        self.data_lib = libs.get_device_data_lib(self.device_type, self.manufacturer, self.part_number, self.protocol)

        # DATA REGISTER MAPPING
        self.data_map = data_mapper.modbus_map(self.data_lib)

    def poll(self):
        try:
            tPoll0 = time.time()  # end polling time

            try:
                self.device = MyModbusTCP.Device(self.ip_address, self.port, self.timeout, self.endianness)
                # print("Connected to ", self.name)
            except:
                tb = traceback.format_exc()
                # print(tb)
                # print("FAILED Connection to", self.name)

            self.raw_data = {}

            ### Read Discrete Input Registers
            _data_map = self.data_map[0]
            if len(_data_map) != 0:
                DiscInData = self.device.read_bits(_data_map[0], _data_map[1], functioncode=2)
                # print(DiscInData)
                self.raw_data.update(DiscInData)

            ### Read Discrete Output Registers
            _data_map = self.data_map[1]
            if len(_data_map) != 0:
                DiscOutData = self.device.read_bits(_data_map[0], _data_map[1], functioncode=1)
                # print(DiscOutData)
                self.raw_data.update(DiscOutData)

            ### Read Input Registers
            for _DataType in MyModbusTCP.DataTypes:
                _data_map = self.data_map[2][_DataType]
                if _DataType in [MyModbusTCP.INT16, MyModbusTCP.INT32, MyModbusTCP.INT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], signed=True, functioncode=4)
self.raw_data.update(RegData)
                        """ %(_DataType)
                        exec(self.command)
                        #print(RegData)

                elif _DataType in [MyModbusTCP.UINT16, MyModbusTCP.UINT32, MyModbusTCP.UINT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], signed=False, functioncode=4)
self.raw_data.update(RegData)
                        """ %(_DataType[1:])
                        exec(self.command)
                        #print(RegData)
                elif _DataType in [MyModbusTCP.FLOAT16, MyModbusTCP.FLOAT32, MyModbusTCP.FLOAT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], functioncode=4)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        # print(RegData)
                elif _DataType == MyModbusTCP.STRING:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], functioncode=4)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        #print(RegData)

            ### Read Holding Registers
            for _DataType in MyModbusTCP.DataTypes:
                _data_map = self.data_map[3][_DataType]
                if _DataType in [MyModbusTCP.INT16, MyModbusTCP.INT32, MyModbusTCP.INT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], signed=True, functioncode=3)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        # print(RegData)
                elif _DataType in [MyModbusTCP.UINT16, MyModbusTCP.UINT32, MyModbusTCP.UINT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], signed=False, functioncode=3)
self.raw_data.update(RegData)
                        """ % (_DataType[1:])
                        exec(self.command)
                        # print(RegData)
                elif _DataType in [MyModbusTCP.FLOAT16, MyModbusTCP.FLOAT32, MyModbusTCP.FLOAT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], functioncode=3)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        # print(RegData)
                elif _DataType == MyModbusTCP.STRING:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], functioncode=3)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        # print(RegData)

            tPoll1 = time.time()  # end polling time

            PollingDuration = tPoll1 - tPoll0
            self.raw_data['PollingDuration'] = PollingDuration
            Timestamp = strftime("%Y-%m-%d %H:%M:%S", localtime())
            self.raw_data['Timestamp'] = Timestamp

            #pp.pprint(self.raw_data)

            # Process Data manufacturer-part_number data
            if self.manufacturer + "_" + self.part_number in datapckgr_by_pn.MANU_PN_LIST:
                self.command = """global _device_pck_pn
_device_pck_pn = datapckgr_by_pn.%s_%s('%s')""" % (self.manufacturer, self.part_number, self.protocol)
                exec(self.command)
                self.data = _device_pck_pn.process_raw_data(self.raw_data)
            else:
                device_pck_pn = datapckgr_by_pn.Device(self.protocol)
                self.data = device_pck_pn.process_raw_data(self.raw_data)

            # Process Data by name data
            if self.name in datapckgr_by_nm.NAME_LIST:
                self.command = """global _device_pck_nm
_device_pck_nm = datapckgr_by_nm.%s()""" % (self.name)
                exec(self.command)
                self.data = _device_pck_nm.process_raw_data(self.data)
            else:
                device_pck_nm = datapckgr_by_nm.Device()
                self.data = device_pck_nm.process_raw_data(self.data)

            return self.data
        except:
            # tb = traceback.format_exc()
            # print(tb)
            return -1

# Class for ModbusRTU polling
class ModbusRTU(object):
    def __init__(self, profile, protocol_setting):
        # Get equipment profile
        self.name = profile['name']
        self.device_type = profile['device_type']
        self.manufacturer = profile['manufacturer']
        self.part_number = profile['part_number']

        # Get equipment settings
        self.protocol = protocol_setting['protocol']
        self.com = protocol_setting['port']
        self.address = int(protocol_setting['address'])
        self.endianness = protocol_setting['endianness']
        self.baudrate = int(protocol_setting['baudrate'])
        self.stop_bit = int(protocol_setting['stop_bit'])
        self.byte_size = int(protocol_setting['bytesize'])
        self.parity = protocol_setting['parity'].upper()
        self.timeout = float(protocol_setting['timeout'])

        self.data_lib = libs.get_device_data_lib(self.device_type, self.manufacturer, self.part_number, self.protocol)

        # DATA REGISTER MAPPING
        self.data_map = data_mapper.modbus_map(self.data_lib)

    def poll(self):
        try:
            tPoll0 = time.time()  # end polling time
            try:
                self.device = MyModbusRTU.Device(self.com, self.address, self.baudrate, self.parity, self.stop_bit,
                                                 self.byte_size, self.endianness, self.timeout)
                print("Connected to ", self.name)
            except:
                tb = traceback.format_exc()
                print(tb)
                print("FAILED Connection to", self.name)
            
            self.raw_data = {}

            ### Read Discrete Input Registers
            _data_map = self.data_map[0]
            if len(_data_map) != 0:
                DiscInData = self.device.read_bits(_data_map[0], _data_map[1], functioncode=2)
                # print(DiscInData)
                self.raw_data.update(DiscInData)

            ### Read Discrete Output Registers
            _data_map = self.data_map[1]
            if len(_data_map) != 0:
                DiscOutData = self.device.read_bits(_data_map[0], _data_map[1], functioncode=1)
                # print(DiscOutData)
                self.raw_data.update(DiscOutData)

            ### Read Input Registers
            for _DataType in MyModbusRTU.DataTypes:
                _data_map = self.data_map[2][_DataType]
                if _DataType in [MyModbusRTU.INT16, MyModbusRTU.INT32, MyModbusRTU.INT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], signed=True, functioncode=4)
self.raw_data.update(RegData)
                        """ %(_DataType)
                        exec(self.command)
                        #print(RegData)

                elif _DataType in [MyModbusRTU.UINT16, MyModbusRTU.UINT32, MyModbusRTU.UINT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], signed=False, functioncode=4)
self.raw_data.update(RegData)
                        """ %(_DataType[1:])
                        exec(self.command)
                        #print(RegData)
                elif _DataType in [MyModbusRTU.FLOAT16, MyModbusRTU.FLOAT32, MyModbusRTU.FLOAT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], functioncode=4)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        # print(RegData)
                elif _DataType == MyModbusRTU.STRING:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], functioncode=4)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        #print(RegData)

            ### Read Holding Registers
            for _DataType in MyModbusRTU.DataTypes:
                _data_map = self.data_map[3][_DataType]
                if _DataType in [MyModbusRTU.INT16, MyModbusRTU.INT32, MyModbusRTU.INT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], signed=True, functioncode=3)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        #print(self.command)
                        exec(self.command)
                        #time.sleep(0.1)
                        #print(RegData)
                elif _DataType in [MyModbusRTU.UINT16, MyModbusRTU.UINT32, MyModbusRTU.UINT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], signed=False, functioncode=3)
self.raw_data.update(RegData)
                        """  % (_DataType[1:]) 
                        #print(self.command)
                        exec(self.command)
                        #time.sleep(0.1)
                        #print(RegData)
                elif _DataType in [MyModbusRTU.FLOAT16, MyModbusRTU.FLOAT32, MyModbusRTU.FLOAT64]:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], _data_map[2], functioncode=3)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        # print(RegData)
                elif _DataType == MyModbusRTU.STRING:
                    if len(_data_map) != 0:
                        self.command = """
RegData = self.device.read_%s(_data_map[0], _data_map[1], functioncode=3)
self.raw_data.update(RegData)
                        """ % (_DataType)
                        exec(self.command)
                        # print(RegData)

            ### Read Holding Registers
            for _DataType in MyModbusRTU.DataTypes:
                _data_map = self.data_map[4][_DataType]
                if len(_data_map) != 0:
                    RegData = self.device.read_ALARM( _data_map[0], _data_map[1], _data_map[2], _data_map[3], _data_map[4], _data_map[5], _DataType )
                    self.raw_data.update(RegData)
                    
            tPoll1 = time.time()  # end polling time

            PollingDuration = tPoll1 - tPoll0
            self.raw_data['PollingDuration'] = PollingDuration
            Timestamp = strftime("%Y-%m-%d %H:%M:%S", localtime())
            self.raw_data['Timestamp'] = Timestamp

            #pp.pprint(self.raw_data)

            # Process Data manufacturer-part_number data
            #if self.manufacturer + "_" + self.part_number in datapckgr_by_pn.MANU_PN_LIST:
                #self.command = """global _device_pck_pn
#_device_pck_pn = datapckgr_by_pn.%s_%s('%s')""" % (self.manufacturer, self.part_number, self.protocol)
                #exec(self.command)
                #self.data = _device_pck_pn.process_raw_data(self.raw_data)
            #else:
            device_pck_pn = datapckgr_by_pn.Device(self.protocol)
            self.data = device_pck_pn.process_raw_data(self.raw_data)

            # Process Data by name data
            if self.name in datapckgr_by_nm.NAME_LIST:
                self.command = """global _device_pck_nm
_device_pck_nm = datapckgr_by_nm.%s()""" % (self.name)
                exec(self.command)
                self.data = _device_pck_nm.process_raw_data(self.data)
            else:
                device_pck_nm = datapckgr_by_nm.Device()
                self.data = device_pck_nm.process_raw_data(self.data)

            #pp.pprint(self.data)
            return self.data
        except Exception as e:
            tb = traceback.format_exc()
            print(tb)
            errlog = open(os.getcwd() + "/errlog.txt", "a+")
            errlog.write("{0} {1} Error: {2}\n".format(strftime("%Y-%m-%d %H:%M:%S", localtime()), self.name, str(e)))
            errlog.close()
            return -1
