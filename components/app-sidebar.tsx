"use client";

import { useTotalErrorCount } from "@/hooks/useTotalErrorCount";
import { useState } from "react";
import UserProfile from "@/components/auth/UserProfile";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  LogOut,
  BarChart3,
  Settings,
  Wifi,
  Database,
  Users,
  FileText,
  Activity,
  Zap,
  Network,
  Play,
  Send,
  Shield,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "@/components/ui/sidebar";
import { Separator } from "@radix-ui/react-separator";
import { deleteCookie } from "cookies-next";
import { useRouter } from "next/navigation";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "MQTT Gateway Dashboard";

const avatarIcon =
  process.env.NEXT_PUBLIC_APP_AVATAR_URL || "/images/avatar-user.png";

// Static menu configuration
const menuData = {
  groups: [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: BarChart3,
        },
        {
          title: "Systems Health",
          url: "/dashboard",
          icon: BarChart3,
        },
      ],
    },
    {
      title: "Network Configuration",
      items: [
        {
          title: "IP Configuration",
          url: "/network/ip-address",
          icon: Network,
        },
        {
          title: "Wifi",
          url: "/network/wifi",
          icon: Wifi,
        },
        {
          title: "MQTT Broker",
          url: "/network/mqtt",
          icon: Send,
        },
        {
          title: "Modbus Protocol",
          url: "/network/protocol/modbus",
          icon: Database,
        },
        {
          title: "SNMP Protocol",
          url: "/network/protocol/snmp",
          icon: Network,
        },
        {
          title: "API Management",
          url: "/api",
          icon: Network,
        },
      ],
    },
    {
      title: "Device Management",
      items: [
        {
          title: "Modbus Devices",
          url: "/devices/modbus",
          icon: Database,
        },
        {
          title: "Modbus Data",
          url: "/modbus-data",
          icon: Database,
        },
        {
          title: "Modular I2C",
          url: "/devices/modular",
          icon: Zap,
        },
        {
          title: "Threshold Settings",
          url: "/devices/threshold",
          icon: Shield,
        },
      ],
    },
    {
      title: "Control Center",
      items: [
        {
          title: "Manual Control",
          url: "/control/manual",
          icon: Play,
        },
        {
          title: "Logic Control",
          url: "/control/logic",
          icon: Settings,
        },
        {
          title: "Value Control",
          url: "/control/value",
          icon: Database,
        },
        {
          title: "Voice Control",
          url: "/control/voice",
          icon: Wifi,
        },
        {
          title: "Scheduled Tasks",
          url: "/control/schedule",
          icon: Activity,
        },
        {
          title: "Payload Remapping",
          url: "/control/remapping",
          icon: Settings,
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
        },
        {
          title: "System Health",
          url: "/settings/system",
          icon: Activity,
        },
        {
          title: "MQTT Configuration",
          url: "/settings/mqtt",
          icon: Send,
        },
        {
          title: "Device Library",
          url: "/settings/library",
          icon: HardDrive,
        },
        {
          title: "User Management",
          url: "/settings/users",
          icon: Users,
        },
        {
          title: "Error Logs",
          url: "/settings/error-log",
          icon: FileText,
        },
      ],
    },
  ],
};

export function AppSidebar() {
  const pathname = usePathname();
  const totalErrors = useTotalErrorCount();
  const router = useRouter();
  const { logout } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const performLogout = async () => {
    await logout(); // Use AuthContext logout to clear user state and localStorage
    deleteCookie("authToken", { path: "/" }); // Also delete cookie for completeness
    router.replace("/auth/login"); // Redirect to login page
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4 bg-background">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center border-gray-400 justify-center rounded-lg bg-primary text-primary-foreground">
            {/* Replaced Atom icon with an <img> tag */}
            <img
              src="/images/gspe.jpg"
              alt="GSPE Logo"
              className="h-full w-full object-cover rounded-lg"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              GSPE
            </h1>
            <p className="text-xs text-sidebar-foreground/70">{appName}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent
        className="bg-background overflow-auto scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {menuData.groups.map((group, groupIndex) => (
          <SidebarGroup key={groupIndex}>
            <SidebarGroupLabel className="text-sidebar-foreground/80">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item, itemIndex) => {
                  const IconComponent = item.icon;
                  return (
                    <SidebarMenuItem key={itemIndex} className="relative">
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url}
                        className="group flex items-center gap-2 px-3 py-2 rounded-md w-full transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                      >
                        <Link href={item.url}>
                          <IconComponent className="h-4 w-4 text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground" />
                          <span>{item.title}</span>
                          {item.title === "Error Logs" && totalErrors > 0 && (
                            <SidebarMenuBadge className="ml-auto bg-destructive text-white">
                              {totalErrors}
                            </SidebarMenuBadge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarFooter className="p-4 bg-background border-t border-sidebar-border">
          <UserProfile />

          <Separator className="my-2 bg-sidebar-border h-px" />
          <SidebarMenu>
            <SidebarMenuItem>
              <AlertDialog
                open={showLogoutDialog}
                onOpenChange={setShowLogoutDialog}
              >
                <AlertDialogTrigger asChild>
                  <SidebarMenuButton className="flex items-center gap-2 text-destructive bg-destructive/5 hover:bg-destructive/20 hover:text-destructive-foreground focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 transition-colors px-3 py-3 rounded-md w-full border border-transparent hover:border-destructive/40">
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm font-medium">Logout</span>
                  </SidebarMenuButton>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Konfirmasi Logout</AlertDialogTitle>
                    <AlertDialogDescription>
                      Apakah Anda yakin ingin logout dari aplikasi? Anda akan
                      diarahkan ke halaman login.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={performLogout}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Logout
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
      <br />
    </Sidebar>
  );
}
