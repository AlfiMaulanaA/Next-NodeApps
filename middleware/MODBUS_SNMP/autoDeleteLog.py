from datetime import date
import os
import schedule
import time

def job2():
    try: 
        os.system("sudo systemctl restart MODBUS_SNMP.service")

        if date.today().day != 1 and date.today().day != 14:
            return
        print("auto delete log running")
        try:
            os.remove("MODBUS_SNMP/errlog.txt")
        except Exception as e:
            pass
        try:
            os.remove("MODULAR_I2C/errlog.txt")
        except Exception as e:
            pass
    except Exception as e:
            pass


schedule.every().day.at("00:45").do(job2)
while True:
    try:
        schedule.run_pending()
        time.sleep(1)
    except Exception as e:
        pass