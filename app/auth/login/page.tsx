//app/auth/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Facebook,
  Twitter,
  Instagram,
  Eye,
  EyeOff,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";

const LoginPage = () => {
  const { theme, setTheme } = useTheme();
  const { login, user, isLoading: authLoading } = useAuth();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [currentImage, setCurrentImage] = useState("/images/images-node-2.png");
  const [loading, setLoading] = useState(false);

  const images = [
    "/images/images-node-2.png",
    "/images/images-node-1.png",
    "/images/images-node-3.png",
  ];

  useEffect(() => {
    let imageIndex = 0;
    const intervalId = setInterval(() => {
      imageIndex = (imageIndex + 1) % images.length;
      setCurrentImage(images[imageIndex]);
    }, 5000);
    return () => clearInterval(intervalId);
  }, [images]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Email and Password are required.");
      toast.error("Email and Password are required.");
      setLoading(false);
      return;
    }

    try {
      const success = await login(email, password);

      if (success) {
        toast.success("Login successful! Welcome back.");
        // Router.push will be handled by useEffect when user state changes
      } else {
        setError("Invalid credentials. Please try again.");
        toast.error("Invalid credentials. Please try again.");
      }
    } catch (err: any) {
      const message = err?.message || "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-sans bg-gradient-to-br from-background via-background/95 to-background/90 relative">
      {/* Kiri: Gambar dan informasi - Dark overlay style */}
      <div
        className="flex-1 relative bg-cover bg-center overflow-hidden hidden lg:block"
        style={{ backgroundImage: "url(/images/border-device.png)" }}
      >
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative flex flex-col justify-between h-full p-6 animate-fadeInLeft">
          {/* Company Info - Better positioned */}
          <div className="flex items-center gap-3 text-card-foreground/90 animate-fadeInUp">
            <Image
              src="/images/gspe.jpg"
              alt="GSPE"
              width={48}
              height={48}
              className="rounded-full shadow-lg"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Production By
              </div>
              <p className="font-bold text-lg leading-tight text-card-foreground">
                PT Graha Sumber Prima Elektronik
              </p>
              <p className="text-card-foreground/70 text-sm leading-tight">
                Manufactur Electrical Panel & Internet Of Things
              </p>
            </div>
          </div>

          {/* Main Content Center */}
          <div className="flex-1 flex items-center justify-center px-8">
            <div className="text-center space-y-8 max-w-lg">
              {/* Hero Text */}
              <div className="space-y-4">
                <h1 className="text-4xl font-bold text-card-foreground leading-tight">
                  IoT Gateway Dashboard
                </h1>
                <p className="text-lg text-card-foreground/80 leading-relaxed">
                  Monitor and control your Modbus, SNMP, and I2C devices through
                  our advanced MQTT-based management system.
                </p>
              </div>

              {/* Animated Device Image - Better positioned & responsive */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl blur-3xl transform scale-110" />
                <div className="relative bg-card/30 backdrop-blur-sm border border-card/20 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500">
                  <Image
                    src={currentImage}
                    alt="MQTT IoT Device"
                    width={280}
                    height={280}
                    key={currentImage}
                    className="w-full max-w-sm h-auto rounded-xl shadow-lg animate-fadeIn transition-all duration-1000 mx-auto"
                    priority
                  />
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      Live Device Monitoring
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Points */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">
                    MQTT
                  </div>
                  <div className="text-card-foreground/70">
                    Real-time Protocol
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">
                    IoT
                  </div>
                  <div className="text-card-foreground/70">
                    Device Management
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Version */}
          <div className="text-center">
            <div className="inline-block px-4 py-2 bg-card/50 backdrop-blur-sm border border-card/20 text-card-foreground/60 text-sm rounded-full">
              v{appVersion || "1.0.0"}
            </div>
          </div>
        </div>
      </div>

      {/* Kanan: Form Login - Full dark mode support */}
      <div className="flex-1 flex items-center justify-center bg-card px-4 sm:px-6 lg:px-8 min-h-screen">
        {/* Theme Toggle - Updated positioning */}
        <div className="absolute top-4 right-4 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="bg-card/80 backdrop-blur-sm border border-border/20 hover:bg-card"
            aria-label={`Switch to ${
              theme === "light" ? "dark" : "light"
            } mode`}
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5 text-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-foreground" />
            )}
          </Button>
        </div>

        <div className="w-full max-w-md space-y-8 animate-slideIn">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-primary-foreground rounded-full animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-foreground animate-fadeInUp">
              Welcome Back
            </h2>
            <p className="text-muted-foreground text-base">
              <span className="relative">
                Sign in to your IoT Gateway Dashboard
                <span
                  className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-primary/50 animate-[width_2s_ease-out_0.5s]"
                  style={{ width: "0%" }}
                />
              </span>
            </p>
          </div>

          {/* Form Input */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                disabled={loading || authLoading}
                className="bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="pr-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
                  disabled={loading || authLoading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none transition-colors"
                  tabIndex={-1}
                >
                  {passwordVisible ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" className="accent-primary" />
                  Remember me
                </label>
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 underline focus:outline-none transition-colors"
                  onClick={() =>
                    toast.info("Password reset feature coming soon!")
                  }
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Tombol Login */}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || authLoading}
            >
              {loading || authLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-primary-foreground"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </Button>

            {/* Error Message */}
            {error && (
              <div className="text-center text-destructive text-sm mt-2 font-medium">
                {error}
              </div>
            )}

            {/* Register Link */}
            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <a
                href="/auth/register"
                className="text-primary hover:text-primary/80 underline font-medium transition-colors"
              >
                Sign up
              </a>
            </p>
          </form>

          {/* Social Media - Disabled untuk security & professionalism */}
          <div className="text-center mt-8 pt-6 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-4">
              Enterprise IoT Solution by GSPE
            </p>
            <div className="flex items-center justify-center gap-4 opacity-50">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-sm">System Online</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="text-xs text-muted-foreground">
                Secure MQTT Gateway
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Version Badge - Hidden on mobile */}
      <div className="absolute bottom-4 right-4 hidden lg:block">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-card/80 backdrop-blur-sm border border-border/50 text-card-foreground/70 text-xs rounded-full shadow-lg hover:shadow-xl transition-all duration-200">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Version {appVersion || "1.0.0"}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
