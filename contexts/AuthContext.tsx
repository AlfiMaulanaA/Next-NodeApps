"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
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

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (userData: RegisterData) => Promise<boolean>;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  department: string;
  role?: "admin" | "user" | "operator" | "developer";
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in from localStorage
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
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

      // Get existing MQTT client from the global MQTT system
      const { connectMQTTAsync } = await import("@/lib/mqttClient");
      const client = await connectMQTTAsync();

      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.error("Login timeout");
          resolve(false);
        }, 5000);

        // Subscribe to response topic
        client.subscribe("response_user_management", { qos: 1 }, (err) => {
          if (err) {
            console.error("Failed to subscribe to auth response:", err);
            resolve(false);
            return;
          }

          // Send authentication request
          const authRequest = {
            command: "authenticate",
            data: { email, password },
          };

          client.publish(
            "command_user_management",
            JSON.stringify(authRequest),
            { qos: 1 },
            (err) => {
              if (err) {
                console.error("Failed to publish auth request:", err);
                resolve(false);
                clearTimeout(timeout);
                return;
              }
            }
          );
        });

        const responseHandler = (topic: string, message: Buffer) => {
          if (topic === "response_user_management") {
            try {
              const response = JSON.parse(message.toString());
              if (
                response.command === "authenticate" &&
                response.success &&
                response.data
              ) {
                const userData = response.data;
                setUser(userData as User);
                localStorage.setItem("auth_user", JSON.stringify(userData));
                console.log("Login successful:", userData.name);
                resolve(true);
              } else {
                console.error(
                  "Login failed:",
                  response.error || "Invalid credentials"
                );
                resolve(false);
              }
            } catch (error) {
              console.error("Login response error:", error);
              resolve(false);
            } finally {
              clearTimeout(timeout);
              client.removeListener("message", responseHandler);
              client.unsubscribe("response_user_management");
            }
          }
        };

        client.on("message", responseHandler);
      });
    } catch (error) {
      console.error("Login setup error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Static mode - client-side logout only
    setUser(null);
    localStorage.removeItem("auth_user");
  };

  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Use MQTT integration instead of REST API
      const { connectMQTTAsync } = await import("@/lib/mqttClient");
      const client = await connectMQTTAsync();

      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.error("Registration timeout");
          resolve(false);
        }, 10000);

        // Subscribe to response topic
        client.subscribe("response_user_management", { qos: 1 }, (err) => {
          if (err) {
            console.error("Failed to subscribe to register response:", err);
            resolve(false);
            return;
          }

          // Send registration request via MQTT
          const registerRequest = {
            command: "add",
            data: {
              name: userData.name,
              email: userData.email,
              password: userData.password,
              department: userData.department,
              status: "active",
              role: userData.role || "user",
            },
          };

          client.publish(
            "command_user_management",
            JSON.stringify(registerRequest),
            { qos: 1 },
            (err) => {
              if (err) {
                console.error("Failed to publish register request:", err);
                resolve(false);
                clearTimeout(timeout);
                return;
              }
            }
          );
        });

        const responseHandler = (topic: string, message: Buffer) => {
          if (topic === "response_user_management") {
            try {
              const response = JSON.parse(message.toString());
              if (response.command === "add") {
                if (response.success && response.message) {
                  console.log("Registration successful:", response.message);
                  // Auto-login after successful registration
                  const loginAfterRegister = async () => {
                    try {
                      const loginSuccess = await login(
                        userData.email,
                        userData.password
                      );
                      resolve(loginSuccess);
                    } catch (loginErr) {
                      console.error(
                        "Auto-login after register failed:",
                        loginErr
                      );
                      resolve(true); // Registration successful, but login failed
                    }
                  };
                  loginAfterRegister();
                } else {
                  console.error(
                    "Registration failed:",
                    response.error || response.message
                  );
                  resolve(false);
                }
              }
            } catch (error) {
              console.error("Registration response error:", error);
              resolve(false);
            } finally {
              clearTimeout(timeout);
              client.removeListener("message", responseHandler);
              client.unsubscribe("response_user_management");
            }
          }
        };

        client.on("message", responseHandler);
      });
    } catch (error) {
      console.error("Registration setup error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        register,
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
