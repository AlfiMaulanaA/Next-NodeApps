"use client"

import {
  LayoutDashboard,
  Users,
  History,
  Wifi,
  Server,
  Activity,
  BarChart,
  Settings,
  LogOut,
  SlidersHorizontal,
  Network,
  Code,
  Cpu,
  ScanLine,
  FileWarning,
  Library,
  Cloud,
  Globe,
  Video,
  AudioLines,
  FileBarChart,
  Radar,
  CircuitBoard,
  Orbit,
} from "lucide-react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Separator } from "@radix-ui/react-separator"

const navigation = [
  {
    title: "Main",
    items: [{ title: "Dashboard Overview", url: "/", icon: LayoutDashboard }],
  },
  {
    title: "Device Management",
    items: [
      { title: "Modular Devices", url: "/devices/modular", icon: Cpu },
      { title: "Modbus Devices", url: "/devices/modbus", icon: Server },
      { title: "Modbit Devices", url: "/devices/modbit", icon: CircuitBoard },
      { title: "I2C Scanner", url: "/devices/i2cScan", icon: ScanLine },
    ],
  },
  {
    title: "Control Center",
    items: [
      { title: "Manual Control", url: "/control/manual", icon: SlidersHorizontal },
      { title: "Scheduled Control", url: "/control/schedule", icon: BarChart },
      { title: "Logic Control", url: "/control/logic", icon: FileBarChart },
      { title: "Voice Control", url: "/control/voice", icon: AudioLines },
      { title: "Value-Based Control", url: "/control/value", icon: FileBarChart },
      { title: "Geofencing", url: "/control/geofence", icon: Globe },
      { title: "Weather Automation", url: "/control/weather", icon: Cloud },
      { title: "CCTV Integration", url: "/control/surveilance", icon: Video },
    ],
  },
  {
    title: "Payload Configuration",
    items: [
      { title: "Dynamic Payloads", url: "/payload/dynamic", icon: Code },
      { title: "Static Payloads", url: "/payload/static", icon: Code },
      { title: "MQTT Discovery", url: "/payload/discover", icon: Radar },
    ],
  },
  {
    title: "Network Settings",
    items: [
      { title: "IP Configuration", url: "/network/ip-address", icon: Network },
      { title: "MQTT Broker", url: "/network/mqtt", icon: Server },
      { title: "WiFi Scanner", url: "/network/wifi", icon: Wifi },
    ],
  },
  {
    title: "System Settings",
    items: [
      { title: "Error Logs", url: "/settings/error-log", icon: FileWarning },
      { title: "Library Manager", url: "/settings/library", icon: Library },
      { title: "General Settings", url: "/settings/setting", icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4 bg-background">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Orbit className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">Node App</h1>
            <p className="text-xs text-sidebar-foreground/70">Monitoring Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-background">
        {navigation.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-sidebar-foreground/80">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      className="group flex items-center gap-2 px-3 py-2 rounded-md w-full transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarFooter className="p-4 bg-background border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-sidebar-border">
              <img src="/images/avatar-user.png" alt="User Avatar" className="object-cover h-full w-full" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-sidebar-foreground">John Doe</span>
              <span className="text-xs text-sidebar-foreground/70">Administrator</span>
            </div>
          </div>
          <Separator className="my-2 bg-sidebar-border h-px" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="flex items-center gap-2 text-destructive bg-destructive/5 hover:bg-destructive/20 hover:text-destructive-foreground focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 transition-colors px-3 py-3 rounded-md w-full border border-transparent hover:border-destructive/40"
                asChild
              >
                <Link href="/auth/login">
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">Logout</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
<br />
    </Sidebar>
  )
}
