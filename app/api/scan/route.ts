import { NextRequest, NextResponse } from 'next/server';

interface DeviceInfo {
  uptime_s: number;
  build: string;
  ip: string;
  mac: string;
  flags: string;
  mqtthost: string;
  mqtttopic?: string;
  chipset: string;
  manufacture: string;
  webapp: string;
  shortName: string;
  startcmd: string;
  supportsSSDP: boolean;
  supportsClientDeviceDB: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '192.168.0';
    const start = parseInt(searchParams.get('start') || '1');
    const end = parseInt(searchParams.get('end') || '254');

    // Validate IP range
    if (start < 1 || start > 254 || end < 1 || end > 254 || start > end) {
      return NextResponse.json(
        { error: 'Invalid IP range. Start and end must be between 1-254, and start <= end' },
        { status: 400 }
      );
    }

    const devices: DeviceInfo[] = [];

    // Simulate network scan for demo purposes
    // In a real implementation, this would scan the actual network
    for (let i = start; i <= end; i++) {
      const ip = `${range}.${i}`;

      // Simulate finding devices (randomly for demo)
      if (Math.random() > 0.8) { // 20% chance of finding a device
        const device: DeviceInfo = {
          uptime_s: Math.floor(Math.random() * 86400 * 30), // Random uptime up to 30 days
          build: `Build-${Math.random().toString(36).substring(7)}`,
          ip: ip,
          mac: `02:${Math.floor(Math.random() * 255).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 255).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 255).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 255).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 255).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 255).toString(16).padStart(2, '0')}`,
          flags: 'Online',
          mqtthost: `mqtt://${range}.1:1883`,
          mqtttopic: `devices/${ip.replace(/\./g, '_')}`,
          chipset: Math.random() > 0.5 ? 'BK7231' : 'ESP32',
          manufacture: Math.random() > 0.5 ? 'Tuya' : 'Espressif',
          webapp: `http://${ip}`,
          shortName: `Device-${i}`,
          startcmd: 'tasmota',
          supportsSSDP: true,
          supportsClientDeviceDB: false
        };

        devices.push(device);
      }
    }

    // Add some specific demo devices
    if (range === '192.168.0' && start <= 100 && end >= 100) {
      devices.push({
        uptime_s: 86400 * 7, // 7 days
        build: 'Tasmota-13.0.0',
        ip: '192.168.0.100',
        mac: '02:81:dd:6e:0f:11',
        flags: 'Online',
        mqtthost: 'mqtt://192.168.0.1:1883',
        mqtttopic: 'Limbah/Modular/relay_mini/1',
        chipset: 'BK7231',
        manufacture: 'Tuya',
        webapp: 'http://192.168.0.100',
        shortName: 'RelayMini-1',
        startcmd: 'tasmota',
        supportsSSDP: true,
        supportsClientDeviceDB: true
      });
    }

    return NextResponse.json(devices);

  } catch (error) {
    console.error('Network scan error:', error);
    return NextResponse.json(
      { error: 'Network scan failed' },
      { status: 500 }
    );
  }
}
