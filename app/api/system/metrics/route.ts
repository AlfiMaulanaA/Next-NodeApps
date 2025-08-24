import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get CPU usage over time
async function getCPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startMeasure = process.cpuUsage();
    const startTime = process.hrtime();
    
    setTimeout(() => {
      const endMeasure = process.cpuUsage(startMeasure);
      const endTime = process.hrtime(startTime);
      
      const usageMicroseconds = endMeasure.user + endMeasure.system;
      const totalMicroseconds = endTime[0] * 1000000 + endTime[1] / 1000;
      
      const cpuPercent = (usageMicroseconds / totalMicroseconds) * 100;
      resolve(Math.min(100, Math.max(0, cpuPercent)));
    }, 100);
  });
}

// Get memory information with proper formatting
function getMemoryInfo() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return {
    used: Math.round((usedMemory / (1024 ** 3)) * 10) / 10, // GB rounded to 1 decimal
    total: Math.round(totalMemory / (1024 ** 3)), // GB rounded to whole number
    percentage: Math.round((usedMemory / totalMemory) * 100), // Percentage as whole number
    free: Math.round((freeMemory / (1024 ** 3)) * 10) / 10 // GB rounded to 1 decimal
  };
}

// Get disk usage (Cross-platform compatible with fallback)
async function getDiskUsage() {
  try {
    // Try PowerShell for Windows as fallback
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync('powershell "Get-WmiObject -Class Win32_LogicalDisk -Filter \\"DriveType=3\\" | Select-Object Size,FreeSpace,DeviceID | ConvertTo-Json"');
        const disks = JSON.parse(stdout);
        const cDrive = Array.isArray(disks) ? disks.find(d => d.DeviceID === 'C:') : disks;
        
        if (cDrive) {
          const total = Math.round(parseInt(cDrive.Size) / (1024 ** 3));
          const free = Math.round((parseInt(cDrive.FreeSpace) / (1024 ** 3)) * 10) / 10;
          const used = Math.round((total - free) * 10) / 10;
          
          return {
            used,
            total,
            percentage: Math.round((used / total) * 100)
          };
        }
      } catch (powerShellError) {
        console.warn('PowerShell fallback failed:', powerShellError);
      }
    } else {
      // Unix-like systems
      const { stdout } = await execAsync("df -h / | awk 'NR==2{print $2,$3,$4,$5}'");
      const parts = stdout.trim().split(/\s+/);
      let total = parseFloat(parts[0].replace(/[GT]/, '')) || 100;
      let used = parseFloat(parts[1].replace(/[GT]/, '')) || 50;
      
      // Convert to GB if needed
      if (parts[0].includes('T')) total = total * 1024;
      if (parts[1].includes('T')) used = used * 1024;
      
      return {
        used: Math.round(used * 10) / 10,
        total: Math.round(total),
        percentage: Math.round((used / total) * 100)
      };
    }
  } catch (error) {
    console.error('Error getting disk usage:', error);
  }
  
  // Fallback with simulated data
  return {
    used: 128,
    total: 256,
    percentage: 50
  };
}

// Get network interfaces info
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const activeInterfaces = Object.values(interfaces)
    .flat()
    .filter(iface => iface && !iface.internal && iface.family === 'IPv4');
  
  return {
    connected: activeInterfaces.length > 0,
    interfaces: activeInterfaces.length,
    addresses: activeInterfaces.map(iface => iface?.address).filter(Boolean)
  };
}

// Get system load
function getSystemLoad() {
  const loadAverage = os.loadavg();
  const cpus = os.cpus();
  
  return {
    loadAverage,
    cores: cpus.length,
    frequency: cpus[0]?.speed / 1000 || 0, // GHz
    model: cpus[0]?.model || 'Unknown'
  };
}

// Get process information
function getProcessInfo() {
  return {
    uptime: process.uptime(),
    pid: process.pid,
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: process.memoryUsage()
  };
}

// Get system temperature - only for Linux, remove for other platforms
async function getTemperature(): Promise<number | null> {
  try {
    if (process.platform === 'linux') {
      const { stdout } = await execAsync('cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -1');
      const temp = parseInt(stdout.trim()) / 1000;
      if (temp > 0 && temp < 100) {
        return Math.round(temp);
      }
    }
  } catch (error) {
    console.warn('Temperature not available:', error);
  }
  
  return null; // Return null if temperature can't be read
}

export async function GET() {
  try {
    const [cpuUsage, diskUsage, temperature] = await Promise.all([
      getCPUUsage(),
      getDiskUsage(),
      getTemperature()
    ]);

    const memory = getMemoryInfo();
    const network = getNetworkInfo();
    const systemLoad = getSystemLoad();
    const processInfo = getProcessInfo();

    const cpuMetrics: any = {
      usage: Math.round(cpuUsage * 10) / 10, // Round to 1 decimal
      cores: systemLoad.cores,
      frequency: Math.round(systemLoad.frequency * 10) / 10, // Round to 1 decimal
      model: systemLoad.model
    };

    // Only add temperature if available
    if (temperature !== null) {
      cpuMetrics.temperature = temperature;
    }

    const metrics = {
      cpu: cpuMetrics,
      memory: {
        used: memory.used,
        total: memory.total,
        percentage: memory.percentage,
        free: memory.free,
        process: {
          rss: Math.round(processInfo.memoryUsage.rss / (1024 ** 2)), // MB rounded
          heapTotal: Math.round(processInfo.memoryUsage.heapTotal / (1024 ** 2)), // MB rounded
          heapUsed: Math.round(processInfo.memoryUsage.heapUsed / (1024 ** 2)), // MB rounded
          external: Math.round(processInfo.memoryUsage.external / (1024 ** 2)) // MB rounded
        }
      },
      disk: diskUsage,
      network: {
        ...network
        // Removed fake upload/download/latency metrics
      },
      system: {
        uptime: os.uptime(),
        processUptime: processInfo.uptime,
        loadAverage: systemLoad.loadAverage,
        platform: processInfo.platform,
        arch: processInfo.arch,
        nodeVersion: processInfo.version,
        hostname: os.hostname(),
        type: os.type(),
        release: os.release()
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system metrics' },
      { status: 500 }
    );
  }
}