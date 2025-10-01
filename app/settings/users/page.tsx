"use client";

import { useState, useEffect, useCallback } from "react";
import { useMQTT } from "@/hooks/useMQTT";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SidebarInset } from "@/components/ui/sidebar";
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  Users,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  status: "active" | "inactive";
  role: "admin" | "user" | "operator" | "developer";
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

interface UserFormData {
  name: string;
  email: string;
  department: string;
  password: string;
  status: "active" | "inactive";
  role: "admin" | "user" | "operator" | "developer";
}

const initialFormData: UserFormData = {
  name: "",
  email: "",
  department: "",
  password: "",
  status: "active",
  role: "user",
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  const { toast } = useToast();

  // MQTT setup
  const { publishMessage, addMessageHandler, isOnline, connectionStatus } =
    useMQTT({
      topics: ["response_user_management"],
      enableLogging: true,
    });

  // Handle MQTT responses
  const handleMQTTResponse = useCallback(
    (topic: string, message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (topic === "response_user_management") {
          console.log("User management response:", data);

          // Handle periodic updates
          if (data.command === "periodic_update" && data.success && data.data) {
            setUsers(data.data);
            setLoading(false);
          }

          // Handle CRUD responses
          else if (data.command === "get" && data.success && data.data) {
            setUsers(data.data);
            setLoading(false);
          } else if (data.command === "add") {
            if (data.success) {
              toast({
                title: "Success",
                description: data.message || "User created successfully",
              });
              setIsCreateDialogOpen(false);
              setFormData(initialFormData);
              // Refresh data
              requestUsers();
            } else {
              toast({
                title: "Error",
                description:
                  data.error || data.message || "Failed to create user",
                variant: "destructive",
              });
            }
          } else if (data.command === "set") {
            if (data.success) {
              toast({
                title: "Success",
                description: data.message || "User updated successfully",
              });
              setIsEditDialogOpen(false);
              setEditingUser(null);
              setFormData(initialFormData);
              // Refresh data
              requestUsers();
            } else {
              toast({
                title: "Error",
                description:
                  data.error || data.message || "Failed to update user",
                variant: "destructive",
              });
            }
          } else if (data.command === "delete") {
            if (data.success) {
              toast({
                title: "Success",
                description: data.message || "User deleted successfully",
              });
              // Refresh data
              requestUsers();
            } else {
              toast({
                title: "Error",
                description:
                  data.error || data.message || "Failed to delete user",
                variant: "destructive",
              });
            }
          }

          setSubmitting(false);
        }
      } catch (error) {
        console.error("Error parsing MQTT message:", error);
        setSubmitting(false);
      }
    },
    [toast]
  );

  // Request users from backend
  const requestUsers = useCallback(() => {
    setLoading(true);
    const payload = {
      command: "get",
    };
    publishMessage("command_user_management", payload);
  }, [publishMessage]);

  // Handle form submission for creating user
  const handleCreateUser = () => {
    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.department
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const payload = {
      command: "add",
      data: {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        department: formData.department,
        status: formData.status,
        role: formData.role,
      },
    };
    publishMessage("command_user_management", payload);
  };

  // Handle form submission for editing user
  const handleUpdateUser = () => {
    if (
      !editingUser ||
      !formData.name ||
      !formData.email ||
      !formData.department
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const payload = {
      command: "set",
      data: {
        id: editingUser.id,
        name: formData.name,
        email: formData.email,
        department: formData.department,
        status: formData.status,
        role: formData.role,
        ...(formData.password && { password: formData.password }),
      },
    };
    publishMessage("command_user_management", payload);
  };

  // Handle user deletion
  const handleDeleteUser = (user: User) => {
    setSubmitting(true);
    const payload = {
      command: "delete",
      data: { id: user.id },
    };
    publishMessage("command_user_management", payload);
  };

  // Open edit dialog with user data
  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      department: user.department,
      password: "", // Don't populate password
      status: user.status,
      role: user.role,
    });
    setIsEditDialogOpen(true);
  };

  // Initialize MQTT message handler and request initial data
  useEffect(() => {
    addMessageHandler("response_user_management", handleMQTTResponse);

    // Request initial users data
    const timer = setTimeout(() => {
      requestUsers();
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [addMessageHandler, handleMQTTResponse, requestUsers]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-300";
      case "developer":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "operator":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === "active"
      ? "bg-green-100 text-green-800 border-green-300"
      : "bg-red-100 text-red-800 border-red-300";
  };

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Settings className="h-5 w-5" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h1 className="text-lg font-semibold">User Management</h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Users
              </CardTitle>
              <UserPlus className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter((u) => u.status === "active").length}
              </div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Administrators
              </CardTitle>
              <Settings className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter((u) => u.role === "admin").length}
              </div>
              <p className="text-xs text-muted-foreground">Admin users</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MQTT Status</CardTitle>
              <RefreshCw
                className={`h-4 w-4 ${
                  isOnline ? "text-green-500" : "text-red-500"
                }`}
              />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {isOnline ? "Connected" : "Disconnected"}
              </div>
              <p className="text-xs text-muted-foreground">
                {connectionStatus}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              onClick={requestUsers}
              disabled={loading || !isOnline}
              variant="outline"
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            {!isOnline && (
              <span className="text-sm text-red-600">MQTT disconnected</span>
            )}
          </div>

          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button disabled={!isOnline}>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system. Make sure to set appropriate
                  permissions.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="create-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-password" className="text-right">
                    Password
                  </Label>
                  <Input
                    id="create-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-department" className="text-right">
                    Department
                  </Label>
                  <Input
                    id="create-department"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-status" className="text-right">
                    Status
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: "active" | "inactive") =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="create-role" className="text-right">
                    Role
                  </Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={submitting}>
                  {submitting ? "Creating..." : "Create User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found. Add your first user to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell>
                          <Badge className={getRoleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(user.status)}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.last_login
                            ? new Date(user.last_login).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(user)}
                              disabled={!isOnline}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  disabled={!isOnline}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete User
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {user.name}?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(user)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-email" className="text-right">
                  Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-password" className="text-right">
                  Password
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Leave empty to keep current"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-department" className="text-right">
                  Department
                </Label>
                <Input
                  id="edit-department"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">
                  Status
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "active" | "inactive") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-role" className="text-right">
                  Role
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateUser} disabled={submitting}>
                {submitting ? "Updating..." : "Update User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarInset>
  );
}
