from Protocols.snmp import NUMERIC, STRING, ALARM_SNMP
from Protocols.modbus_rtu import DataTypes, DISCRETEIN, DISCRETEOUT, HOLDINGREG, INPUTREG, ALARM_RTU

def snmp_map(var_list):
    #Variable Clustering
    tab_num_vars = {ITEM : [] for ITEM in NUMERIC}
    tab_str_vars = {ITEM : [] for ITEM in STRING}
    reg_num_vars = {ITEM : [] for ITEM in NUMERIC}
    reg_str_vars = {ITEM : [] for ITEM in STRING}
    alarm_vars   = {ITEM : [] for ITEM in ALARM_SNMP}

    _var_list = [dict(item) for item in var_list]
    for var in _var_list:
        data_type = var['data_type']
        is_table = var['is_table']

        if data_type in ALARM_SNMP:
            del var['data_type']
            del var['is_table']
            alarm_vars[data_type].append(list(var.values()))
        else:
            if is_table == 1:
                if data_type in NUMERIC:
                    del var['data_type']
                    del var['is_table']
                    tab_num_vars[data_type].append(list(var.values()))
                elif data_type in STRING:
                    del var['is_table']
                    del var['data_type']
                    del var['multiplier']
                    tab_str_vars[data_type].append(list(var.values()))
            else:
                if data_type in NUMERIC:
                    del var['data_type']
                    del var['is_table']
                    del var['total_row']
                    reg_num_vars[data_type].append(list(var.values()))
                elif data_type in STRING:
                    del var['data_type']
                    del var['is_table']
                    del var['total_row']
                    del var['multiplier']
                    reg_str_vars[data_type].append(list(var.values()))

    # Transpose
    tab_num_vars = {ITEM: list(map(list, zip(*tab_num_vars[ITEM]))) for ITEM in NUMERIC}
    tab_str_vars = {ITEM: list(map(list, zip(*tab_str_vars[ITEM]))) for ITEM in STRING}
    reg_num_vars = {ITEM: list(map(list, zip(*reg_num_vars[ITEM]))) for ITEM in NUMERIC}
    reg_str_vars = {ITEM: list(map(list, zip(*reg_str_vars[ITEM]))) for ITEM in STRING}
    alarm_vars   = {ITEM: list(map(list, zip(*alarm_vars[ITEM]))) for ITEM in ALARM_SNMP}
    
    return tab_num_vars, tab_str_vars, reg_num_vars, reg_str_vars, alarm_vars

def modbus_map(var_list):
    # Variable Clustering
    discrete_input_vars = []
    discrete_output_vars = []
    input_register_vars = {ITEM : [] for ITEM in DataTypes}
    holding_register_vars = {ITEM : [] for ITEM in DataTypes}
    alarm_register_vars = {ITEM : [] for ITEM in DataTypes}

    _var_list = [dict(item) for item in var_list]
    for var in _var_list:
        data_type = var['data_type']
        register_type = var['register_type']

        del var['data_type']
        del var['register_type']
        
        if register_type in ALARM_RTU:
            alarm_register_vars[data_type].append(list(var.values()))
        else:
            if register_type == DISCRETEIN:
                del var['multiplier']
                discrete_input_vars.append(list(var.values()))
            elif register_type == DISCRETEOUT:
                del var['multiplier']
                discrete_output_vars.append(list(var.values()))
            elif register_type == INPUTREG:
                input_register_vars[data_type].append(list(var.values()))
            elif register_type == HOLDINGREG:
                holding_register_vars[data_type].append(list(var.values()))

    # Sort Registers from Lowest to Highest
    try:
        discrete_input_vars = sorted(discrete_input_vars, key = lambda x: int(x[1]))
    except:
        pass

    try:
        discrete_output_vars = sorted(discrete_output_vars, key = lambda x: int(x[1]))
    except:
        pass

    for each_type in DataTypes:
        try:
            input_register_vars[each_type] = sorted(input_register_vars[each_type], key = lambda x: int(x[1]))
        except:
            pass
        try:
            holding_register_vars[each_type] = sorted(holding_register_vars[each_type], key = lambda x: int(x[1]))
        except:
            pass
        try:
            alarm_register_vars[each_type] = sorted(alarm_register_vars[each_type], key = lambda x: int(x[1]))
        except:
            pass

    # Transpose
    discrete_input_vars = list(map(list, zip(*discrete_input_vars)))
    discrete_output_vars = list(map(list, zip(*discrete_output_vars)))
    input_register_vars = {ITEM: list(map(list, zip(*input_register_vars[ITEM]))) for ITEM in DataTypes}
    holding_register_vars = {ITEM: list(map(list, zip(*holding_register_vars[ITEM]))) for ITEM in DataTypes}
    alarm_register_vars = {ITEM: list(map(list, zip(*alarm_register_vars[ITEM]))) for ITEM in DataTypes}

    # Transform the data map into a format that can be easily used by Modbus Module
    _discrete_input_vars = [[],[]]
    try:
        for i in range(0,len(discrete_input_vars[1])):
            var_name = discrete_input_vars[0][i]
            start_address = discrete_input_vars[1][i]
            word_length = discrete_input_vars[2][i]
            address_list = list(range(start_address, start_address + word_length))
            _discrete_input_vars[0].append(var_name)
            _discrete_input_vars[1].append(address_list)

        discrete_input_vars = _discrete_input_vars
    except:
        pass

    _discrete_output_vars = [[],[]]
    try:
        for i in range(0,len(discrete_output_vars[1])):
            var_name = discrete_output_vars[0][i]
            start_address = discrete_output_vars[1][i]
            word_length = discrete_output_vars[2][i]
            address_list = list(range(start_address, start_address+word_length))
            _discrete_output_vars[0].append(var_name)
            _discrete_output_vars[1].append(address_list)

        discrete_output_vars = _discrete_output_vars
    except:
        pass

    for each_type in DataTypes:
        vars = input_register_vars[each_type]
        _vars = [[], [], []]

        try:
            for i in range(0, len(vars[1])):
                var_name = vars[0][i]
                start_address = vars[1][i]
                word_length = vars[2][i]
                multiplier = vars[3][i]
                address_list = list(range(start_address, start_address + word_length))
                _vars[0].append(var_name)
                _vars[1].append(address_list)
                _vars[2].append(multiplier)
            input_register_vars[each_type] = _vars
        except:
            pass

        vars = holding_register_vars[each_type]
        _vars = [[], [], []]
        try:
            for i in range(0, len(vars[1])):
                var_name = vars[0][i]
                start_address = vars[1][i]
                word_length = vars[2][i]
                multiplier = vars[3][i]
                address_list = list(range(start_address, start_address + word_length))
                _vars[0].append(var_name)
                _vars[1].append(address_list)
                _vars[2].append(multiplier)
            holding_register_vars[each_type] = _vars
        except:
            pass

        

        vars = alarm_register_vars[each_type]
        _vars = [[], [], [], [], []]
        try:
            for i in range(0, len(vars[1])):
                var_name = vars[0][i]
                start_address = vars[1][i]
                word_length = vars[2][i]
                multiplier = vars[3][i]
                alarm_type = vars[4][i]
                function_code = vars[5][i]
                address_list = list(range(start_address, start_address + word_length))
                _vars[0].append(var_name)
                _vars[1].append(address_list)
                _vars[2].append(multiplier)
                _vars[3].apend(alarm_type)
                _vars[4].append(function_code)
            alarm_register_vars[each_type] = _vars
        except:
            pass

    # Simplification for faster data polling
    # Increase modbus polling efficiency to reduce polling time
    # how? some adjacent registers are unified into one sublist
    MAXREGISTERREAD = 50
    '''
    DiscInAddress = []
    try:
        for reg_list in discrete_input_vars[1]:
            if len(DiscInAddress) == 0:
                DiscInAddress.append(reg_list)
            else:
                if (reg_list[0] - DiscInAddress[-1][-1]) == 1 and (len(DiscInAddress[-1]) + len(reg_list))<MAXREGISTERREAD:
                    DiscInAddress[-1] += reg_list
                else:
                    DiscInAddress.append(reg_list)
        discrete_input_vars[1] = DiscInAddress
    except:
        pass

    DiscOutAddress = []
    try:
        for reg_list in discrete_output_vars[1]:
            if len(DiscOutAddress) == 0:
                DiscOutAddress.append(reg_list)
            else:
                if (reg_list[0] - DiscOutAddress[-1][-1]) == 1 and (len(DiscOutAddress[-1]) + len(reg_list))<MAXREGISTERREAD:
                    DiscOutAddress[-1] += reg_list
                else:
                    DiscOutAddress.append(reg_list)
        discrete_output_vars[1] = DiscOutAddress
    except:
        pass
    '''

    for each_type in DataTypes:
        _Address = []
        if each_type != "STRING":
            try:
                for reg_list in input_register_vars[each_type][1]:
                    if len(_Address) == 0:
                        _Address.append(reg_list)
                    else:
                        if (reg_list[0] - _Address[-1][-1]) == 1 and (len(_Address[-1]) + len(reg_list))<MAXREGISTERREAD:
                            _Address[-1] += reg_list
                        else:
                            _Address.append(reg_list)
                input_register_vars[each_type][1] = _Address
            except:
                pass

        _Address = []
        if each_type != "STRING":
            try:
                for reg_list in holding_register_vars[each_type][1]:
                    if len(_Address) == 0:
                        _Address.append(reg_list)
                    else:
                        if (reg_list[0] - _Address[-1][-1]) == 1 and (len(_Address[-1]) + len(reg_list))<MAXREGISTERREAD:
                            _Address[-1] += reg_list
                        else:
                            _Address.append(reg_list)
                holding_register_vars[each_type][1] = _Address
            except:
                pass
        
        _Address = []
        if each_type != "STRING":
            try:
                for reg_list in alarm_register_vars[each_type][1]:
                    if len(_Address) == 0:
                        _Address.append(reg_list)
                    else:
                        if (reg_list[0] - _Address[-1][-1]) == 1 and (len(_Address[-1]) + len(reg_list))<MAXREGISTERREAD:
                            _Address[-1] += reg_list
                        else:
                            _Address.append(reg_list)
                alarm_register_vars[each_type][1] = _Address
            except:
                pass

    #print(alarm_register_vars)

    return discrete_input_vars, discrete_output_vars, input_register_vars, holding_register_vars, alarm_register_vars