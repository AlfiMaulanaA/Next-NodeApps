"use client";

import {
  SiNodedotjs,
  SiPython,
  SiTypescript,
  SiJavascript,
  SiNextdotjs,
  SiHtml5,
  SiTailwindcss,
  SiCss3,
} from "react-icons/si";

import {
  FileQuestion,
  Network,
  Server,
  Settings,
  HardDrive,
  RotateCw,
  SatelliteDish,
  GaugeCircle,
  BarChart3,
  Database,
  Wrench,
  Code,
  Calculator,
  Mic,
  Clock,
  ArrowLeftRight,
  Search,
  Shield,
  Wifi,
  Monitor,
  Activity,
  FileText,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";

// Static menu configuration (copied from app-sidebar.tsx)
const menuData = {
  groups: [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: BarChart3,
          isUse: true,
        },
      ],
    },
    {
      title: "Network Configuration",
      items: [
        {
          title: "IP Address Settings",
          url: "/network/ip-address",
          icon: Network,
          isUse: true,
        },
        {
          title: "WiFi Settings",
          url: "/network/wifi",
          icon: Wifi,
          isUse: true,
        },
        {
          title: "SNMP Protocol",
          url: "/network/protocol/snmp",
          icon: Monitor,
          isUse: true,
        },
      ],
    },
    {
      title: "Device Management",
      items: [
        {
          title: "Modbus Device Manager",
          url: "/devices/modbus",
          icon: HardDrive,
          isUse: true,
        },
        {
          title: "SNMP MIB Data",
          url: "/snmp-data-panasonic",
          icon: Activity,
          isUse: true,
        },
      ],
    },
    {
      title: "System Settings",
      items: [
        {
          title: "General Settings",
          url: "/settings/setting",
          icon: Settings,
          isUse: true,
        },
        {
          title: "Error Logs",
          url: "/settings/error-log",
          icon: FileText,
          isUse: true,
        },
        {
          title: "Information",
          url: "/info",
          icon: Info,
          isUse: true,
        },
      ],
    },
  ],
};

// Function to map menu items to features
const mapMenuToFeatures = () => {
  const featureMap: Record<string, any> = {
    "Dashboard": {
      icon: <BarChart3 className="w-6 h-6 text-blue-600" />,
      category: "Overview",
      description: "Real-time dashboard displaying system status, device connectivity, and key metrics overview.",
    },
    "IP Address Settings": {
      icon: <Network className="w-6 h-6 text-green-600" />,
      category: "Network Configuration",
      description: "Configure network interfaces, IP addresses, subnet masks, and gateway settings.",
    },
    "WiFi Settings": {
      icon: <Wifi className="w-6 h-6 text-blue-500" />,
      category: "Network Configuration",
      description: "Configure wireless network settings, access points, and connection parameters.",
    },
    "SNMP Protocol": {
      icon: <Monitor className="w-6 h-6 text-purple-600" />,
      category: "Network Configuration",
      description: "Configure SNMP communication protocol settings and monitoring parameters.",
    },
    "Modbus Device Manager": {
      icon: <HardDrive className="w-6 h-6 text-orange-600" />,
      category: "Device Management",
      description: "Manage Modbus RTU and TCP devices, configure communication parameters and data mappings.",
    },
    "SNMP MIB Data": {
      icon: <Activity className="w-6 h-6 text-cyan-600" />,
      category: "Device Management",
      description: "Access and manage SNMP MIB data, monitoring information bases for network devices.",
    },
    "General Settings": {
      icon: <Settings className="w-6 h-6 text-gray-600" />,
      category: "System Settings",
      description: "System-wide configurations, user preferences, and interface customization options.",
    },
    "Error Logs": {
      icon: <FileText className="w-6 h-6 text-red-600" />,
      category: "System Settings",
      description: "View system error logs, diagnostic information, and troubleshooting data.",
    },
    "Information": {
      icon: <Info className="w-6 h-6 text-indigo-600" />,
      category: "System Settings",
      description: "System information, version details, and feature documentation.",
    },
  };

  const features: any[] = [];

  menuData.groups.forEach(group => {
    group.items.forEach(item => {
      if (item.isUse === true && featureMap[item.title]) {
        features.push({
          title: item.title,
          ...featureMap[item.title]
        });
      }
    });
  });

  return features;
};

export default function InfoPage() {
  const { theme } = useTheme();

  // Dynamic image based on theme
  const gatewayImage = theme === 'dark'
    ? "/images/ilustation-mqtt-gateway-dark.png"
    : "/images/ilustation-mqtt-gateway-light.png";

  // Get features dynamically based on enabled menu items
  const features = mapMenuToFeatures();

  const techStack = [
    { name: "Node.js", icon: <SiNodedotjs size={32} className="text-green-600" />, description: "Backend runtime environment" },
    { name: "Python", icon: <SiPython size={32} className="text-blue-500" />, description: "Device control and automation" },
    { name: "Next.js", icon: <SiNextdotjs size={32} className="text-black dark:text-white" />, description: "React framework for web interface" },
    { name: "TypeScript", icon: <SiTypescript size={32} className="text-sky-600" />, description: "Type-safe JavaScript" },
    { name: "Tailwind CSS", icon: <SiTailwindcss size={32} className="text-cyan-500" />, description: "Utility-first CSS framework" },
    { name: "MQTT", icon: <SatelliteDish size={32} className="text-red-600" />, description: "Lightweight messaging protocol" },
    { name: "Modbus", icon: <Network size={32} className="text-blue-600" />, description: "Industrial communication protocol" },
    { name: "PostgreSQL", icon: <Database size={32} className="text-blue-700" />, description: "Data persistence and logging" },
  ];

  const systemSpecs = [
    { label: "Architecture", value: "Full-stack IoT Gateway" },
    { label: "Communication", value: "MQTT, Modbus RTU/TCP, SNMP" },
    { label: "Real-time Monitoring", value: "Live data streams & alerts" },
    { label: "Automation", value: "Rule-based triggers & actions" },
    { label: "User Interface", value: "Modern web-based dashboard" },
    { label: "Data Persistence", value: "SQLite/PostgreSQL database" },
    { label: "Security", value: "Authentication & secure communications" },
  ];

  return (
    <SidebarInset>
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <FileQuestion className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">System Information</h1>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => window.location.reload()}
          title="Reload page"
        >
          <RotateCw className="w-4 h-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <main className="px-6 py-8 space-y-8">
          {/* System Overview */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Server className="w-6 h-6 text-primary" />
              <h2 className="text-3xl font-bold">MQTT Gateway Dashboard</h2>
            </div>

            {/* MQTT Gateway Illustration and Description */}
            <div className="flex flex-col lg:flex-row items-start gap-8 mb-6">
              {/* Image Section */}
              <div className="flex-shrink-0 w-[300px]">
                <div className="relative">
                  <img
                    src={gatewayImage}
                    alt="MQTT Gateway Illustration"
                    className="w-full h-auto rounded-lg shadow-lg border border-border"
                  />
                </div>
              </div>

              {/* Description Section */}
              <div className="flex-1 w-full lg:w-1/2">
                <p className="text-muted-foreground leading-relaxed text-lg">
  A comprehensive IoT gateway solution for industrial automation and smart infrastructure management.
  This system provides unified control, monitoring, and data management capabilities for diverse industrial
  and IoT devices through multiple communication protocols.
</p>

<p className="text-muted-foreground leading-relaxed text-lg mt-4">
  The application includes an intuitive dashboard for real-time monitoring, device configuration,
  and performance analytics. It supports seamless integration with MQTT, Modbus, SNMP, and HTTP APIs,
  enabling flexible connectivity across heterogeneous systems. Advanced logging, alerting, and reporting
  features ensure reliable operation, while secure authentication and role-based access control
  maintain system integrity. This makes it ideal for use in data centers, factories, and smart city
  infrastructures.
</p>

              </div>
            </div>

            {/* System Specifications Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {systemSpecs.map((spec, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium">{spec.label}:</span>
                  <Badge variant="outline">{spec.value}</Badge>
                </div>
              ))}
            </div>

            
          </section>

          <Separator />

          {/* Features Overview */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <GaugeCircle className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">System Features</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="h-full hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      {feature.icon}
                      <div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {feature.category}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Separator />

          {/* Technology Stack */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Code className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Technology Stack</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {techStack.map((tech, index) => (
                <Card key={index} className="p-4 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    {tech.icon}
                    <h3 className="font-semibold">{tech.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{tech.description}</p>
                </Card>
              ))}
            </div>
          </section>

          <Separator />

          {/* System Architecture */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Network className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Architecture Overview</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Frontend (Web Interface)</CardTitle>
                  <CardDescription>Modern, responsive dashboard for system management</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Real-time data visualization</li>
                    <li>• Intuitive control interfaces</li>
                    <li>• Multi-device management</li>
                    <li>• Automated monitoring alerts</li>
                    <li>• Responsive design for all devices</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Backend (Edge Processing)</CardTitle>
                  <CardDescription>Robust gateway with protocol translation</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Multi-protocol communication</li>
                    <li>• Real-time data processing</li>
                    <li>• Rule-based automation engine</li>
                    <li>• Secure MQTT bridging</li>
                    <li>• Industrial-grade reliability</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

           
          </section>

          <Separator />

          {/* Getting Started */}
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Getting Started</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="text-center">
                  <CardHeader>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-blue-600">1</span>
                    </div>
                    <CardTitle className="text-lg">Network Setup</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Configure IP addresses, WiFi settings, and MQTT broker connections
                    </p>
                  </CardContent>
                </Card>

                <Card className="text-center">
                  <CardHeader>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-green-600">2</span>
                    </div>
                    <CardTitle className="text-lg">Device Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Add and configure Modbus devices, I2C modules, and communication parameters
                    </p>
                  </CardContent>
                </Card>

                <Card className="text-center">
                  <CardHeader>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-purple-600">3</span>
                    </div>
                    <CardTitle className="text-lg">Automation Setup</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Configure triggers, actions, and automated control logic for your devices
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </main>
      </div>
    </SidebarInset>
  );
}
