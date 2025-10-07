//app/auth/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Facebook, Twitter, Instagram, Eye, EyeOff, Sun, Moon, Download, FileText } from "lucide-react";
import { useTheme } from "next-themes";
import RealtimeClockWithRefresh from "@/components/realtime-clock";

const LoginPage = () => {
  const { theme, setTheme } = useTheme();
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
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated) {
      router.push("/");
    }
  }, [router]);

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
      // Static hardcoded credentials
      const VALID_EMAIL = "admin@gmail.com";
      const VALID_PASSWORD = "pass123";

      if (email === VALID_EMAIL && password === VALID_PASSWORD) {
        // Simulate successful login for static user
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("user", JSON.stringify({
          email: VALID_EMAIL,
          name: "Administrator"
        }));

        toast.success("Login successful! Welcome back.");
        setTimeout(() => router.push("/"), 300);
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

  // Function to download user manual
  const handleDownloadManual = () => {
    try {
      const link = document.createElement('a');
      link.href = '/files/USER MANUAL GATEWAY MONITORING.pdf';
      link.download = 'USER MANUAL GATEWAY MONITORING.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("User Manual downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download user manual");
      console.error("Download error:", error);
    }
  };

  return (
    <div className="flex min-h-screen font-sans bg-black/20 dark:bg-[#040a0f] relative ">
      {/* Kiri: Gambar dan informasi */}
      <div
        className="flex-1 relative bg-cover bg-center overflow-hidden hidden lg:block"
        style={{
          backgroundImage: `url(${theme === "dark" ? "/images/border-device-dark.png" : "/images/border-device-light.png"})`
        }}
      >
        {/* Overlay tambahan untuk dark mode */}
        <div
          className="absolute inset-0 bg-black/20 dark:bg-black/45 transition-opacity duration-500 ease-in-out"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0% 100%)" }}
        ></div>

        <div
          className="absolute inset-0 bg-black/50 dark:bg-white/20 p-8 m-8 rounded-2xl flex flex-col justify-between animate-fadeInLeft transition-all duration-500 ease-in-out"
          style={{ clipPath: "polygon(0% 0, 100% 0, 85% 100%, 0% 100%)" }}
        >
          {/* Info Produksi */}
          <div className="absolute top-6 left-6 z-10 text-white">
            <div className="text-sm font-medium mb-2">Production By</div>
            <div className="flex items-center gap-2 animate-fadeInUp">
              <Image
                src="/images/gspe.jpg"
                alt="GSPE"
                width={40}
                height={40}
                className="rounded-full"
              />
              <div>
                <p className="font-bold leading-tight">
                  PT Graha Sumber Prima Elektronik
                </p>
                <p className="text-white/70 text-sm leading-tight">
                  Manufactur Electrical Panel & Internet Of Things
                </p>
              </div>
            </div>
          </div>

          {/* Gambar Utama */}
          <div className="flex flex-1 justify-center items-center mr-6">
            <Image
              src={currentImage}
              alt="MQTT Device"
              width={600}
              height={600}
              key={currentImage}
              className="rounded-md animate-fadeIn transition-all duration-1000"
            />
          </div>

          {/* Deskripsi tambahan di bagian bawah gambar */}
          <div className="absolute bottom-6 left-6 right-6 text-white/90 text-center">
            <p className="text-sm font-medium mb-2 fw-bold animate-fadeInUp delay-500">
              Advanced IoT Gateway Solution
            </p>
            <p className="text-xs text-white animate-fadeInUp delay-700">
              Industrial-grade MQTT gateway with SNMP support for seamless device integration and monitoring
            </p>
            <p className="text-xs text-white animate-fadeInUp delay-1000 mt-2">
              Experience robust connectivity with our cutting-edge gateway technology that enables real-time data acquisition,
              protocol conversion, and secure communication across heterogeneous industrial networks and IoT devices.
            </p>
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border border-border w-[700px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">User Manual</p>
                  <p className="text-xs text-foreground">Download gateway monitoring guide</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadManual}
                className="flex items-center text-primary gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
            </div>
          </div>
          </div>
          
        </div>
      </div>

      {/* Kanan: Form Login */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-900 px-4 sm:px-6 lg:px-8 transition-all duration-500 ease-in-out border-l-2 border-primary/10 shadow-xl shadow-black/5" style={{ clipPath: "polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)" }}>
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          <RealtimeClockWithRefresh />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label="Toggle Theme"
            className="flex items-center gap-2"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === "light" ? "Dark" : "Light"}
          </Button>
        </div>

        <div className="w-full max-w-md space-y-6 animate-slideIn py-12">
          <div>
            <h2 className="text-3xl font-bold text-center text-foreground animate-fadeInUp">
              Hi, Welcome Back.
            </h2>
            <p className="text-center text-muted-foreground mt-2 text-sm">
              <span
                className="inline-block border-r-2 border-blue-500 pr-2 animate-typing overflow-hidden whitespace-nowrap"
                style={{
                  animation:
                    "typing 2.5s steps(30, end), blink-caret .75s step-end infinite",
                }}
              >
                Welcome to Nodes MQTT Gateway Software
              </span>
            </p>
          </div>

          {/* Form Input */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 focus:outline-none"
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
                  <input type="checkbox" className="accent-blue-600" /> Remember
                  me
                </label>
                <a
                  href="#"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Forgot password?
                </a>
              </div>
            </div>

            {/* Tombol Login */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white"
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
              <div className="text-center text-red-500 text-sm mt-2">
                {error}
              </div>
            )}

            {/* Info */}
            <p className="text-center text-sm text-muted-foreground">
              Contact administrator for account access
            </p>
          </form>

          {/* Sosial Media */}
          <div className="text-center mt-4 space-x-4">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600"
            >
              <Facebook className="w-5 h-5 inline" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-500"
            >
              <Twitter className="w-5 h-5 inline" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-pink-500"
            >
              <Instagram className="w-5 h-5 inline" />
            </a>
          </div>
        </div>
      </div>

      {/* Versi Aplikasi */}
      <div className="absolute bottom-2 right-4 text-xs text-muted-foreground border border-border px-3 py-1 rounded-full bg-card/70 backdrop-blur-sm shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md hover:bg-card">
        Version {appVersion}
      </div>
    </div>
  );
};

export default LoginPage;
