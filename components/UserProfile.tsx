"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function UserProfile() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  // Get role color scheme (simplified without icons)
  const getRoleStyle = (role: string) => {
    switch (role) {
      case "admin":
        return {
          badge: "bg-primary/10 text-primary border-primary/20",
          avatarRing: "ring-2 ring-primary/20",
          text: "text-sidebar-foreground"
        };
      case "developer":
        return {
          badge: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
          avatarRing: "ring-2 ring-green-500/20",
          text: "text-sidebar-foreground"
        };
      case "operator":
        return {
          badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
          avatarRing: "ring-2 ring-blue-500/20",
          text: "text-sidebar-foreground"
        };
      default:
        return {
          badge: "bg-muted text-muted-foreground border-muted-foreground/20",
          avatarRing: "ring-2 ring-muted-foreground/20",
          text: "text-sidebar-foreground"
        };
    }
  };

  const initials = user.name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

  const style = getRoleStyle(user.role);

  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Avatar className={`w-9 h-9 ${style.avatarRing} shrink-0`}>
        <AvatarImage src="/images/avatar-user.png" alt={user.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${style.text} truncate`}>
          {user.name}
        </p>
        <Badge
          variant="outline"
          className={`text-xs capitalize ${style.badge} mt-1`}
        >
          {user.role}
        </Badge>
      </div>
    </div>
  );
}
