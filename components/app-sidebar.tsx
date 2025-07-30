"use client"

import { useTotalErrorCount } from "@/hooks/useTotalErrorCount"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useState } from "react"
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
  Atom,
  ShieldAlert,
  HardDriveUpload,
  InfoIcon,
  Mail, User2, MapPin, School
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
  SidebarMenuBadge,
} from "@/components/ui/sidebar"
import { Separator } from "@radix-ui/react-separator"
import { deleteCookie } from 'cookies-next';
import { useRouter } from 'next/navigation'; // Keep the import here


const appName = process.env.NEXT_PUBLIC_APP_NAME || "MQTT Gateway Dashboard";

const avatarIcon = process.env.NEXT_PUBLIC_APP_AVATAR_URL || "/images/avatar-user.png";

const navigation = [
  {
    title: "Main",
    items: [{ title: "Dashboard Overview", url: "/", icon: LayoutDashboard }],
  },
  {
    title: "Device Management",
    items: [
      // { title: "Modular Devices", url: "/devices/modular", icon: Cpu },
      { title: "Modbus Devices", url: "/devices/modbus", icon: Server },
      { title: "Battery Threshold", url: "/devices/threshold", icon: ShieldAlert },
    ],
  },
  // {
  //   title: "Control Center",
  //   items: [
  //     { title: "Manual Control", url: "/control/manual", icon: SlidersHorizontal },
  //     { title: "Scheduled Control", url: "/control/schedule", icon: BarChart },
  //     { title: "Logic Control", url: "/control/logic", icon: FileBarChart },
  //     { title: "Voice Control", url: "/control/voice", icon: AudioLines },
  //     { title: "Value-Based Control", url: "/control/value", icon: FileBarChart },
  //   ],
  // },
  // {
  //   title: "Payload Configuration",
  //   items: [
  //     { title: "Dynamic Payloads", url: "/payload/dynamic", icon: Code },
  //     { title: "Static Payloads", url: "/payload/static", icon: Code },
  //     { title: "MQTT Discovery", url: "/payload/discover", icon: Radar },
  //   ],
  // },
  {
    title: "Network Settings",
    items: [
      { title: "WiFi Scanner", url: "/network/wifi", icon: Wifi },
      { title: "IP Configuration", url: "/network/ip-address", icon: Network },
      // { title: "MQTT Broker", url: "/network/mqtt", icon: Server },
      { title: "Comm Out Modbus TCP", url: "/network/protocol/modbus", icon: HardDriveUpload },
      { title: "Comm Out SNMP", url: "/network/protocol/snmp", icon: HardDriveUpload },
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
  {
    title: "FAQ & About",
    items:[
      { title: "Information", url:"/info",icon: InfoIcon },
    ]
  }
]

export function AppSidebar() {
  const pathname = usePathname();
  const totalErrors = useTotalErrorCount();
  // Move useRouter inside the functional component
  const router = useRouter();

  const handleLogout = () => {
    deleteCookie('authToken', { path: '/' }); // Hapus cookie
    router.replace('/auth/login'); // Arahkan ke halaman login
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4 bg-background">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center border-gray-400 justify-center rounded-lg bg-primary text-primary-foreground">
            {/* Replaced Atom icon with an <img> tag */}
            <img src="/images/gspe.jpg" alt="GSPE Logo" className="h-full w-full object-cover rounded-lg" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">GSPE</h1>
            <p className="text-xs text-sidebar-foreground/70">{appName }</p>
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
                  <SidebarMenuItem key={item.title} className="relative">
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      className="group flex items-center gap-2 px-3 py-2 rounded-md w-full transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                        <span>{item.title}</span>
                        {item.title === "Error Logs" && totalErrors > 0 && (
                          <SidebarMenuBadge className="ml-auto bg-destructive text-white">
                            {totalErrors}
                          </SidebarMenuBadge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarFooter className="p-4 bg-background border-t border-sidebar-border">
          <Dialog>
            <DialogTrigger asChild>
              <div className="flex items-center gap-3 mb-4 px-1 cursor-pointer hover:bg-muted rounded-md p-1 transition hover:shadow-sm">
                <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-sidebar-border">
                  <img
                    src={avatarIcon}
                    alt="User Avatar"
                    className="object-cover h-full w-full"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-sidebar-foreground">
                    Admin
                  </span>
                  <span className="text-xs text-sidebar-foreground/70">
                    Administrator
                  </span>
                </div>
              </div>
            </DialogTrigger>

            <DialogContent className="max-w-md animate-in fade-in zoom-in-75 bg-gradient-to-br from-white to-muted p-6 rounded-xl shadow-xl border">
              <DialogHeader>
                <DialogTitle className="text-center text-lg font-bold text-foreground">
                  User Profile
                </DialogTitle>
                <DialogDescription className="text-center text-muted-foreground">
                  Your account information
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center mt-2">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary shadow-md mb-2">
                  <img
                    src={avatarIcon}
                    alt="User Avatar"
                    className="object-cover w-full h-full"
                  />
                </div>
                <h3 className="text-lg font-semibold">Admin</h3>
                <p className="text-sm text-muted-foreground mb-4 italic">
                  IoT & Electrical Engineer
                </p>
              </div>

              <Separator />

              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">Email:</span>{" "}
                    alfi@example.com
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <User2 className="w-4 h-4 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">Role:</span>{" "}
                    Administrator
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">Location:</span>{" "}
                    West Jakarta, Indonesia
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <School className="w-4 h-4 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">Company:</span>{" "}
                    PT Graha Sumber Prima Elektronik
                  </span>
                </p>
              </div>

              <Separator className="mt-4" />

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="destructive" className="hover:scale-105 transition" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Separator className="my-2 bg-sidebar-border h-px" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="flex items-center gap-2 text-destructive bg-destructive/5 hover:bg-destructive/20 hover:text-destructive-foreground focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 transition-colors px-3 py-3 rounded-md w-full border border-transparent hover:border-destructive/40"
                asChild
              >
                <span onClick={handleLogout} className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="text-sm font-medium">Logout</span>
                </span>
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