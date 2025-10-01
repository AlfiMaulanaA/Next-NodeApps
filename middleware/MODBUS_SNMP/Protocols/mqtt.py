import sys
from itertools import islice
import paho.mqtt.client as mqtt
import json
from time import strftime, localtime
import time, os, traceback, pprint, psutil

pp = pprint.PrettyPrinter(indent=4)

class Client(object):
    def __init__(self, broker_address, broker_port, retain, qos, username="", password=None):
        self.client = mqtt.Client()
        self.broker_address = broker_address
        self.broker_port = broker_port
        self.qos = qos
        self.retain = retain
        self.username = username
        self.password = password

    def chunks(self, data, SIZE=15000):
        it = iter(data)
        for i in range(0, len(data), SIZE):
            yield {k:data[k] for k in islice(it, SIZE)}
    
    def set_usr_pw(self, username = None, password = None):
        if password:
            self.password = password
            self.client.username_pw_set(self.password)
            #print("Done set password:", self.password)
        if username:
            self.username = username
            self.client.username_pw_set(self.username, self.password)
            #print("Done set username:", self.username, "password:", self.password)

    def connect(self):
        self.client.connect(self.broker_address, self.broker_port, 60)
        #print("Connected to ", self.broker_address, self.broker_port)

    def loop_start(self):
        self.client.loop_start()

    def publish(self, topic, data):
        """
        Timestamp = strftime("%Y-%m-%d %H:%M:%S", localtime())
        
        if type(data) == dict:
            data["Timestamp"] = Timestamp
            
        self.client.publish(topic, json.dumps(data), self.qos, self.retain)
        #Timestamp = strftime("%Y-%m-%d %H:%M:%S", localtime())
        #print("Published new data at", Timestamp, topic, json.dumps(data))
        pp.pprint(data)
        print("succesfull publish to: " + topic)
        #print("Published on", topic, ">>>",json.dumps(data))
        """
        lol = lambda lst, sz: [lst[i:i+sz] for i in range(0, len(lst), sz)]
        Timestamp = strftime("%Y-%m-%d %H:%M:%S", localtime())
        
        if type(data) == dict:
            data["Timestamp"] = Timestamp
        if len(data) <= 300:
            self.client.publish(topic, json.dumps(data), self.qos, self.retain)
            pp.pprint(data)
        else:
            devide_data = self.chunks(data, 300)
            i = 0
            for data_max in devide_data:
                i = i + 1
                self.client.publish(topic + "/" + str(i), json.dumps(data_max), self.qos, self.retain)
                pp.pprint(data_max)
                time.sleep(1)
        print("succesfull publish to: " + topic)
        print("The size of the dictionary is {} bytes".format(sys.getsizeof(data)))
        print("The lenght of the dictionary is {}".format(len(data)))
        

    def loop_stop(self):
        self.client.loop_stop()

    def disconnect(self):
        self.client.disconnect()
