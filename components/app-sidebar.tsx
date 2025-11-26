"use client";

import { memo, useState } from "react";
import {
  LogOut,
  BarChart3,
  Settings,
  Wifi,
  FileText,
  Activity,
  Network,
  Send,
  HardDrive,
  Combine,
  Search,
  ArrowLeftRight,
  Hand,
  Code,
  Calculator,
  Mic,
  Clock,
  Monitor,
  Cpu,
  Shield,
  Info,
  Lock,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useTotalErrorCount } from "@/hooks/useTotalErrorCount";

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
          title: "MQTT Broker Config",
          url: "/network/mqtt",
          icon: Send,
          isUse: true,
        },
        {
          title: "Modbus Protocol",
          url: "/network/protocol/modbus",
          icon: HardDrive,
          isUse: true,
        },
        {
          title: "SNMP Protocol",
          url: "/network/protocol/snmp",
          icon: Monitor,
          isUse: true,
        },
        {
          title: "VPN Settings",
          url: "/network/vpn",
          icon: Lock,
          isUse: true,
        },
        {
          title: "VPN Config",
          url: "/network/vpn/config",
          icon: Settings,
          isUse: true,
        },
      ],
    },
    {
      title: "Device Management",
      items: [
        {
          title: "Modbus/SNMP Device",
          url: "/devices/modbus",
          icon: HardDrive,
          isUse: true,
        },
        {
          title: "Modular I2C Devices",
          url: "/devices/modular",
          icon: Cpu,
          isUse: true,
        },
        {
          title: "SNMP MIB Data",
          url: "/snmp-data-shoto",
          icon: Activity,
          isUse: false,
        },
        {
          title: "SNMP MIB Data",
          url: "/snmp-data-panasonic",
          icon: Activity,
          isUse: false,
        },
        {
          title: "SNMP Data Get/Walk",
          url: "/snmp-data-get",
          icon: Wifi,
          isUse: true,
        },
        {
          title: "SNMP MIB Data",
          url: "/snmp-data-shoto",
          icon: Activity,
          isUse: true,
        },

        {
          title: "Threshold & Alerts",
          url: "/devices/threshold",
          icon: Shield,
          isUse: false,
        },
      ],
    },
    {
      title: "Payload Management",
      items: [
        {
          title: "Payload Discover & Publisher",
          url: "/payload/discover",
          icon: Search,
          isUse: true,
        },
        {
          title: "Payload Remapping",
          url: "/payload/remapping",
          icon: ArrowLeftRight,
          isUse: true,
        },
        {
          title: "Payload Static Configuration",
          url: "/payload/static",
          icon: Settings,
          isUse: true,
        },
      ],
    },
    {
      title: "Control Center",
      items: [
        {
          title: "Manual Control",
          url: "/control/manual",
          icon: Hand,
          isUse: true,
        },
        {
          title: "Unified Automation",
          url: "/control/unified",
          icon: Combine,
          isUse: true,
        },
        {
          title: "Logic Control",
          url: "/control/logic",
          icon: Code,
          isUse: true,
        },
        {
          title: "Value Control",
          url: "/control/value",
          icon: Calculator,
          isUse: true,
        },
        {
          title: "Voice Control",
          url: "/control/voice",
          icon: Mic,
          isUse: true,
        },
        {
          title: "Scheduler Control",
          url: "/control/schedule",
          icon: Clock,
          isUse: true,
        },
        {
          title: "Rule Chains",
          url: "/control/chains",
          icon: GitBranch,
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
          title: "RTC DS3231 Sync",
          url: "/settings/rtc-sync",
          icon: Clock,
          isUse: true,
        },
        {
          title: "Device Library",
          url: "/settings/library",
          icon: HardDrive,
          isUse: true,
        },
        {
          title: "Error Logs",
          url: "/settings/error-log",
          icon: FileText,
          isUse: true,
        },
        {
          title: "Node Info Configuration",
          url: "/settings/node-info",
          icon: Info,
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

export const AppSidebar = memo(function AppSidebar() {
  const pathname = usePathname();
  const totalErrors = useTotalErrorCount();
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  // Simple logout function
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("user");
    sessionStorage.clear();
    window.location.href = "/auth/login";
  };

  // Handle logout button click - show confirmation dialog
  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  // Handle confirm logout
  const handleConfirmLogout = () => {
    setShowLogoutDialog(false);
    handleLogout();
  };

  // Handle cancel logout
  const handleCancelLogout = () => {
    setShowLogoutDialog(false);
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
        {menuData.groups.map((group, groupIndex) => {
          // Filter items that have isUse: true
          const visibleItems = group.items.filter(
            (item) => item.isUse !== false
          );

          // Only render the group if it has visible items
          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <SidebarGroup key={groupIndex}>
              <SidebarGroupLabel className="text-sidebar-foreground/80">
                {group.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item, itemIndex) => {
                    const IconComponent = item.icon;
                    return (
                      <SidebarMenuItem key={itemIndex} className="relative">
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.url}
                          className="group flex items-center gap-2 px-3 py-2 rounded-md w-full transition-colors text-sidebar-foreground hover:bg-muted/50 hover:text-sidebar-accent-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium data-[active=true]:border-l-2 data-[active=true]:border-l-primary"
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
          );
        })}

        <SidebarFooter className="p-4 bg-background border-t border-sidebar-border">
          {/* Simple user info */}
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-primary font-medium text-sm">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                Administrator
              </p>
              <p className="text-xs text-sidebar-foreground/70 truncate">
                admin@gmail.com
              </p>
            </div>
          </div>

          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogoutClick}
                className="flex items-center gap-2 text-destructive bg-destructive/5 hover:bg-destructive/20 hover:text-destructive-foreground transition-colors px-3 py-3 rounded-md w-full border border-transparent hover:border-destructive/40"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />

      {/* Logout Confirmation Dialog */}
      <ConfirmationDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        type="warning"
        title="Confirm Logout"
        description="Are you sure you want to log out? You will need to log in again to access the system."
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
        destructive={true}
      />
    </Sidebar>
  );
});
