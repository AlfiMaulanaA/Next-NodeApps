"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import UserManager from "@/lib/user-management";

// Use the same User interface from UserManager
export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  status: "active" | "inactive";
  role: "admin" | "user" | "operator" | "developer";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in from localStorage, but also sync with UserManager
    const storedUser = localStorage.getItem("auth_user");
    const currentUserManagerUser = UserManager.getCurrentAuthenticatedUser();

    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        // Verify the user data structure and check if still valid in UserManager
        if (userData && typeof userData === 'object' && userData.email) {
          // Check if user still exists and is active in UserManager
          const managerUser = UserManager.getUserByEmail(userData.email);
          if (managerUser && managerUser.isActive) {
            setUser({
              ...userData,
              department: managerUser.metadata?.department || 'IT',
              status: managerUser.isActive ? 'active' : 'inactive',
            });
          } else {
            // User no longer valid, remove from localStorage
            localStorage.removeItem("auth_user");
          }
        } else {
          localStorage.removeItem("auth_user");
        }
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        localStorage.removeItem("auth_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Use UserManager for authentication
      const result = await UserManager.authenticateUser(email, password);

      if (result.success && result.user) {
        // Convert UserManager user format to AuthContext format
        const authUser: User = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          department: result.user.metadata?.department || 'IT',
          status: result.user.isActive ? 'active' : 'inactive',
          role: result.user.role as any, // Safe cast since roles are aligned
        };

        setUser(authUser);
        localStorage.setItem("auth_user", JSON.stringify(authUser));

        console.log("Login successful:", authUser.name);
        return true;
      } else {
        console.error("Invalid credentials");
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("auth_user");
    // Also logout from UserManager for consistency
    UserManager.logoutUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
