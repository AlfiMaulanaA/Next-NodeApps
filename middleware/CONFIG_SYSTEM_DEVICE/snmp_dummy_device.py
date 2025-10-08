#!/usr/bin/env python3
"""
SNMP Dummy Device Server
Simulates a real SNMP-enabled device (e.g., Panasonic BMS) for testing purposes

Features:
- SNMP v2c GET/WALK/SET operations
- Realistic MIB structure with device data
- Dynamic value updates for testing
- Configurable device parameters
- Detailed logging for debugging
"""

import time
import datetime
import random
import json
import logging
from pysnmp.entity import engine, config
from pysnmp.carrier.asynsock.dgram import udp
from pysnmp.entity.rfc3413 import ntfrcv, mibvar
from pysnmp.proto.rfclib import rfc1902, rfc1905
from pysnmp.smi import builder, instrum, error
from pysnmp.smi.rfc1902 import ObjectIdentity

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DummyDeviceSNMPAgent:
    """
    SNMP Agent that simulates a Panasonic DCB105ZK-BMS or similar device
    Provides realistic OID structure with dynamic values
    """

    def __init__(self, device_ip="127.0.0.1", device_port=161):
        self.device_ip = device_ip
        self.device_port = device_port

        # Initialize SNMP Engine
        self.snmpEngine = engine.SnmpEngine()

        # Device data storage (simulates real device registers)
        self.device_data = self._initialize_device_data()

        # MIB builder for custom OIDs
        self.mibBuilder = self.snmpEngine.getMibBuilder()

        # Timer for value updates
        self.last_update = time.time()

        logger.info(f"Dummy SNMP Device initialized at {device_ip}:{device_port}")

    def _initialize_device_data(self):
        """
        Initialize realistic device data values
        Simulates a Panasonic BMS with battery system data
        """
        return {
            # System Information
            'sysDescr': "Panasonic DCB105ZK-BMS v1.2.3.45",
