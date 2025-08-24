import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: string;
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'warning';
  uptime: number;
  port?: number;
  memory?: number;
  cpu?: number;
  pid?: number;
}

// Get running processes with fallback
async function getProcessList(): Promise<ProcessInfo[]> {
  try {
    if (process.platform === 'win32') {
      try {
        // Try PowerShell approach
        const { stdout } = await execAsync('powershell "Get-Process | Select-Object Name,Id,WorkingSet,CPU -First 10 | ConvertTo-Json"');
        const processes = JSON.parse(stdout);
        const processArray = Array.isArray(processes) ? processes : [processes];
        
        return processArray.map((proc: any) => ({
          pid: proc.Id || 0,
          name: proc.Name || 'Unknown',
          cpu: parseFloat(proc.CPU) || 0,
          memory: (proc.WorkingSet || 0) / (1024 * 1024), // Convert to MB
          status: 'running'
        }));
      } catch (powerShellError) {
        console.warn('PowerShell process list failed:', powerShellError);
        return [];
      }
    } else {
      // Unix-like systems
      const { stdout } = await execAsync("ps aux | awk 'NR>1{print $2,$11,$3,$4,$8}' | head -10");
      const lines = stdout.trim().split('\n');
      
      return lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[0]) || 0,
          name: parts[1] || 'Unknown',
          cpu: parseFloat(parts[2]) || 0,
          memory: parseFloat(parts[3]) || 0,
          status: parts[4] || 'running'
        };
      });
    }
  } catch (error) {
    console.error('Error getting process list:', error);
    
    // Return basic Node.js process info as fallback
    return [{
      pid: process.pid,
      name: 'node',
      cpu: 0,
      memory: process.memoryUsage().heapUsed / (1024 * 1024),
      status: 'running'
    }];
  }
}

// Check service status by port
async function checkPortStatus(port: number): Promise<boolean> {
  try {
    let command = '';
    if (process.platform === 'win32') {
      command = `netstat -an | findstr :${port}`;
    } else {
      command = `netstat -tuln | grep :${port}`;
    }
    
    const { stdout } = await execAsync(command);
    return stdout.includes(`:${port}`);
  } catch (error) {
    return false;
  }
}

// Get real service status - only show current Node.js process
async function getServicesStatus(): Promise<ServiceStatus[]> {
  const services: ServiceStatus[] = [
    { 
      name: 'Node.js Application', 
      status: 'running', 
      uptime: Math.round(process.uptime()), 
      memory: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)), // MB
      cpu: 0, // CPU usage would require more complex monitoring
      pid: process.pid
    }
  ];

  return services;
}

// Get system statistics
async function getSystemStats() {
  try {
    let command = '';
    if (process.platform === 'win32') {
      command = 'wmic process get ProcessId | find /c /v ""';
    } else {
      command = 'ps aux | wc -l';
    }
    
    const { stdout } = await execAsync(command);
    const processCount = parseInt(stdout.trim()) || 0;
    
    return {
      totalProcesses: processCount,
      nodeProcesses: 1, // Current Node.js process
      systemLoad: process.cpuUsage(),
      platform: process.platform,
      uptime: process.uptime()
    };
  } catch (error) {
    return {
      totalProcesses: 0,
      nodeProcesses: 1,
      systemLoad: process.cpuUsage(),
      platform: process.platform,
      uptime: process.uptime()
    };
  }
}

export async function GET() {
  try {
    const [processes, services, stats] = await Promise.all([
      getProcessList(),
      getServicesStatus(),
      getSystemStats()
    ]);

    return NextResponse.json({
      processes,
      services,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching process information:', error);
    return NextResponse.json(
      { error: 'Failed to fetch process information' },
      { status: 500 }
    );
  }
}