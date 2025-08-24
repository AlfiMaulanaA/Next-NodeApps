def getSpecialData(snmp_dev, VarNameList, values):
    try: 
        data = (snmp_dev.get(".1.3.6.1.4.1.850.1.1.3.3.3.1.1.1.2").value / 10)
        VarNameList.append("Environtment_Temperature")
        values.append(data)
    except:
        VarNameList.append("Environtment_Temperature")
        values.append("None")