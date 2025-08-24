import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

// Get network interfaces with detailed information
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const networkInfo: any[] = [];
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (addrs) {
      for (const addr of addrs) {
        if (!addr.internal) {
          networkInfo.push({
            interface: name,
            family: addr.family,
            address: addr.address,
            netmask: addr.netmask,
            mac: addr.mac,
            cidr: addr.cidr
          });
        }
      }
    }
  }
  
  return networkInfo;
}

// Get network statistics with fallback
async function getNetworkStats() {
  try {
    let stats = {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      errorsReceived: 0,
      errorsSent: 0
    };

    if (process.platform === 'win32') {
      try {
        // Use PowerShell for Windows
        const { stdout } = await execAsync('powershell "Get-NetAdapterStatistics | Select-Object Name,BytesReceived,BytesSent,PacketsReceived,PacketsSent | ConvertTo-Json"');
        const adapters = JSON.parse(stdout);
        const adapterArray = Array.isArray(adapters) ? adapters : [adapters];
        
        if (adapterArray.length > 0) {
          const adapter = adapterArray[0];
          stats = {
            bytesReceived: parseInt(adapter.BytesReceived) || 0,
            bytesSent: parseInt(adapter.BytesSent) || 0,
            packetsReceived: parseInt(adapter.PacketsReceived) || 0,
            packetsSent: parseInt(adapter.PacketsSent) || 0,
            errorsReceived: 0,
            errorsSent: 0
          };
        }
      } catch (powerShellError) {
        console.warn('PowerShell network stats failed:', powerShellError);
      }
    } else if (process.platform === 'linux') {
      const { stdout } = await execAsync('cat /proc/net/dev | grep -E "(eth|wlan|en)" | head -1');
      const lines = stdout.trim().split('\n');
      if (lines.length > 0) {
        const data = lines[0].split(/\s+/);
        if (data.length >= 10) {
          stats = {
            bytesReceived: parseInt(data[1]) || 0,
            packetsReceived: parseInt(data[2]) || 0,
            errorsReceived: parseInt(data[3]) || 0,
            bytesSent: parseInt(data[9]) || 0,
            packetsSent: parseInt(data[10]) || 0,
            errorsSent: parseInt(data[11]) || 0
          };
        }
      }
    } else if (process.platform === 'darwin') {
      const { stdout } = await execAsync('netstat -ib | grep -E "(en|wl)" | head -1');
      const data = stdout.trim().split(/\s+/);
      if (data.length >= 7) {
        stats = {
          bytesReceived: parseInt(data[6]) || 0,
          bytesSent: parseInt(data[9]) || 0,
          packetsReceived: parseInt(data[4]) || 0,
          packetsSent: parseInt(data[7]) || 0,
          errorsReceived: parseInt(data[5]) || 0,
          errorsSent: parseInt(data[8]) || 0
        };
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting network stats:', error);
    return {
      bytesReceived: 0,
      bytesSent: 0,
      packetsReceived: 0,
      packetsSent: 0,
      errorsReceived: 0,
      errorsSent: 0
    };
  }
}

// Removed connectivity testing - too unreliable and slow for dashboard

// Get active connections
async function getActiveConnections() {
  try {
    let command = '';
    if (process.platform === 'win32') {
      command = 'netstat -an | find "ESTABLISHED" | find /c /v ""';
    } else {
      command = 'netstat -tuln | grep ESTABLISHED | wc -l';
    }
    
    const { stdout } = await execAsync(command);
    return parseInt(stdout.trim()) || 0;
  } catch (error) {
    return 0;
  }
}

// Get listening ports
async function getListeningPorts() {
  try {
    let command = '';
    if (process.platform === 'win32') {
      command = 'netstat -an | find "LISTENING"';
    } else {
      command = 'netstat -tuln | grep LISTEN';
    }
    
    const { stdout } = await execAsync(command);
    const ports: number[] = [];
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const match = line.match(/:(\d+)\s/);
      if (match) {
        const port = parseInt(match[1]);
        if (port && !ports.includes(port)) {
          ports.push(port);
        }
      }
    }
    
    return ports.sort((a, b) => a - b).slice(0, 20); // Top 20 ports
  } catch (error) {
    return [];
  }
}

export async function GET() {
  try {
    const [networkStats, activeConnections, listeningPorts] = await Promise.all([
      getNetworkStats(),
      getActiveConnections(),
      getListeningPorts()
    ]);

    const interfaces = getNetworkInterfaces();

    const networkData = {
      interfaces,
      stats: networkStats,
      activeConnections,
      listeningPorts,
      hostname: os.hostname(),
      platform: os.platform(),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(networkData);
  } catch (error) {
    console.error('Error fetching network information:', error);
    return NextResponse.json(
      { error: 'Failed to fetch network information' },
      { status: 500 }
    );
  }
}