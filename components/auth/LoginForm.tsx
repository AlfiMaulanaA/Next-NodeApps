"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn, Loader2 } from "lucide-react";

export default function LoginForm() {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    const success = await login(formData.email, formData.password);

    if (success) {
      toast.success("Login successful!");
    } else {
      toast.error("Invalid credentials");
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <LogIn className="w-5 h-5" />
          Login to IoT Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Username/Email</Label>
            <Input
              id="email"
              type="text"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="Enter username or email"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging in...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Login
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 text-sm text-center text-muted-foreground space-y-2">
          <div className="border-t pt-2">
            <p className="font-medium text-primary">Static Demo Credentials:</p>
            <p className="text-xs">Admin: admin@gmail.com / pass123</p>
            <p className="text-xs">User: user@gmail.com / pass123</p>
            <p className="text-xs">Developer: developer@gmail.com / pass123</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}