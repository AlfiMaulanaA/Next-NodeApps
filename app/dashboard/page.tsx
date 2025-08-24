"use client";

import { useEffect, useState, useCallback } from "react";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  BarChart3,
  Clock,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  MonitorSpeaker,
  Network,
  Power,
  Router,
  Server,
  Settings,
  Thermometer,
  TrendingUp,
  Users,
  Wifi,
  Zap,
  Globe,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  Calendar,
  PieChart,
} from "lucide-react";

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number; // Optional - only available on some systems
    frequency: number;
    model?: string;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    free: number;
    process: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    connected: boolean;
    interfaces: number;
    addresses: string[];
  };
  system: {
    uptime: number;
    processUptime: number;
    loadAverage: number[];
    platform: string;
    arch: string;
    nodeVersion: string;
    hostname: string;
    type: string;
    release: string;
  };
}

interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | 'warning';
  uptime: number;
  port?: number;
  memory?: number;
  cpu?: number;
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [activeConnections, setActiveConnections] = useState(0);
  // Removed fake analytics - totalRequests, errorRate
  const [loading, setLoading] = useState(true);
  const [networkInfo, setNetworkInfo] = useState<any>(null);

  // Fetch real system metrics
  const fetchSystemMetrics = async () => {
    try {
      const response = await fetch('/api/system/metrics');
      if (response.ok) {
        const data = await response.json();
        setSystemMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching system metrics:', error);
    }
  };

  // Fetch process and service information  
  const fetchProcessInfo = async () => {
    try {
      const response = await fetch('/api/system/processes');
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error('Error fetching process info:', error);
    }
  };

  // Fetch network information
  const fetchNetworkInfo = async () => {
    try {
      const response = await fetch('/api/system/network');
      if (response.ok) {
        const data = await response.json();
        setNetworkInfo(data);
        setActiveConnections(data.activeConnections || 0);
      }
    } catch (error) {
      console.error('Error fetching network info:', error);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSystemMetrics(),
        fetchProcessInfo(), 
        fetchNetworkInfo()
      ]);
      setLoading(false);
    };

    loadInitialData();
  }, []);

  // Real-time data updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // Refresh system metrics every 5 seconds
      fetchSystemMetrics();
      
      // Refresh process info every 10 seconds
      if (Date.now() % 10000 < 2000) {
        fetchProcessInfo();
      }
      
      // Refresh network info every 15 seconds
      if (Date.now() % 15000 < 2000) {
        fetchNetworkInfo();
      }
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const formatUptime = useCallback((seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }, []);

  // Format bytes to human readable
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  // Format large numbers with K, M, B suffixes
  const formatNumber = useCallback((num: number): string => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'stopped': return <XCircle className="h-4 w-4 text-gray-400" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'stopped': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <MonitorSpeaker className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">System Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            {currentTime.toLocaleTimeString()}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            {currentTime.toLocaleDateString()}
          </Badge>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <span className="ml-3 text-lg">Loading system metrics...</span>
          </div>
        )}

        {/* Quick Stats Overview */}
        {!loading && systemMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
                System Load
              </CardTitle>
              <Cpu className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {systemMetrics.cpu.usage}%
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Progress 
                  value={systemMetrics.cpu.usage} 
                  className="flex-1 h-2"
                />
                <span className="text-xs text-blue-700 dark:text-blue-300">
                  {systemMetrics.cpu.cores} cores
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">
                Memory Usage
              </CardTitle>
              <MemoryStick className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {systemMetrics.memory.percentage}%
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Progress 
                  value={systemMetrics.memory.percentage} 
                  className="flex-1 h-2"
                />
                <span className="text-xs text-green-700 dark:text-green-300">
                  {systemMetrics.memory.used} / {systemMetrics.memory.total} GB
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">
                Active Connections
              </CardTitle>
              <Network className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {activeConnections}
              </div>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">
                <TrendingUp className="h-3 w-3 inline mr-1" />
                +12% from last hour
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-900 dark:text-orange-100">
                System Uptime
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                {formatUptime(systemMetrics.system.uptime)}
              </div>
              <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                Process: {formatUptime(systemMetrics.system.processUptime)}
              </p>
            </CardContent>
          </Card>
        </div>
        )}

        {!loading && systemMetrics && (
        <Tabs defaultValue="system" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Services
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Network
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Monitoring
            </TabsTrigger>
          </TabsList>

          <TabsContent value="system" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    CPU Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Usage</span>
                      <span>{systemMetrics.cpu.usage}%</span>
                    </div>
                    <Progress value={systemMetrics.cpu.usage} className="h-3" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cores:</span>
                      <span className="font-medium">{systemMetrics.cpu.cores}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frequency:</span>
                      <span className="font-medium">{systemMetrics.cpu.frequency} GHz</span>
                    </div>
                    {systemMetrics.cpu.temperature && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Temperature:</span>
                        <span className="font-medium">{systemMetrics.cpu.temperature}°C</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Load Avg:</span>
                      <span className="font-medium">{Math.round(systemMetrics.system.loadAverage[0] * 100) / 100}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Storage & Memory
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Disk Usage</span>
                      <span>{systemMetrics.disk.used} / {systemMetrics.disk.total} GB</span>
                    </div>
                    <Progress value={systemMetrics.disk.percentage} className="h-3" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Memory Usage</span>
                      <span>{systemMetrics.memory.used} / {systemMetrics.memory.total} GB</span>
                    </div>
                    <Progress value={systemMetrics.memory.percentage} className="h-3" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform:</span>
                      <span className="font-medium">{systemMetrics.system.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Node.js:</span>
                      <span className="font-medium">{systemMetrics.system.nodeVersion}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Service Status
                </CardTitle>
                <CardDescription>
                  Monitor running services and their resource usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(service.status)}
                        <div>
                          <div className="font-medium">{service.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {service.port && `Port: ${service.port} • `}
                            Uptime: {formatUptime(service.uptime)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                        {service.status === 'running' && service.memory && (
                          <div className="text-right text-sm">
                            <div>CPU: {Math.round(service.cpu || 0)}%</div>
                            <div className="text-muted-foreground">RAM: {Math.round(service.memory)} MB</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="network" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Network Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Network Interfaces</span>
                      <span className="font-medium">{systemMetrics.network.interfaces}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Active Addresses</span>
                      <span className="font-medium">{systemMetrics.network.addresses.length}</span>
                    </div>
                    {systemMetrics.network.addresses.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Primary: {systemMetrics.network.addresses[0]}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    Connection Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className={systemMetrics.network.connected ? 
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }>
                      {systemMetrics.network.connected ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Connections:</span>
                      <span className="font-medium">{activeConnections}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hostname:</span>
                      <span className="font-medium">{systemMetrics.system.hostname}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform:</span>
                      <span className="font-medium">{systemMetrics.system.platform}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Application Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Application Status</span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Running
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Architecture</span>
                      <span className="font-medium">{systemMetrics.system.arch}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Node.js Version</span>
                      <span className="font-medium">{systemMetrics.system.nodeVersion}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Thermometer className="h-5 w-5" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {systemMetrics.cpu.temperature && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Temperature</span>
                        <span className="font-medium">{systemMetrics.cpu.temperature}°C</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm">System Uptime</span>
                      <span className="font-medium">{formatUptime(systemMetrics.system.uptime)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Process Uptime</span>
                      <span className="font-medium">{formatUptime(systemMetrics.system.processUptime)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Power className="h-4 w-4 mr-2" />
                      Restart Services
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Database className="h-4 w-4 mr-2" />
                      Clear Cache
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Activity className="h-4 w-4 mr-2" />
                      View Logs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </div>
    </SidebarInset>
  );
}