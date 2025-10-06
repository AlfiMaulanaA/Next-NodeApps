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
import { Facebook, Twitter, Instagram, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import DatabaseConnectionBadge from "@/components/database-status";
import MQTTConnectionBadge from "@/components/mqtt-status";

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
    <div className="flex min-h-screen font-sans bg-gray-100 relative">
      {/* Kiri: Gambar dan informasi */}
      <div
        className="flex-1 relative bg-cover bg-center overflow-hidden hidden lg:block"
        style={{ backgroundImage: "url(/images/border-device.png)" }}
      >
        <div
          className="absolute inset-0 bg-black/60 p-8 m-8 rounded-2xl flex flex-col justify-between animate-fadeInLeft"
          style={{ clipPath: "polygon(0 0, 80% 0, 100% 100%, 0% 100%)" }}
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
          <div className="flex justify-start items-end h-full pb-12 pl-12">
            <Image
              src={currentImage}
              alt="MQTT Device"
              width={400}
              height={400}
              key={currentImage}
              className="rounded-md animate-fadeIn transition-all duration-1000"
            />
          </div>
        </div>
      </div>

      {/* Kanan: Form Login */}
      <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8">
        <div className="absolute top-4 right-4 z-50">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label="Toggle Theme"
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        </div>

        <div className="w-full max-w-md space-y-6 animate-slideIn py-12">
          <div>
            <h2 className="text-3xl font-bold text-center text-gray-900 animate-fadeInUp">
              Hi, Welcome Back.
            </h2>
            <p className="text-center text-gray-500 mt-2 text-sm">
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
                disabled={loading || authLoading}
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
                  disabled={loading || authLoading}
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
                <label className="flex items-center gap-2 text-xs text-gray-600">
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
            <Button type="submit" className="w-full" disabled={loading || authLoading}>
              {(loading || authLoading) ? (
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

            {/* Daftar */}
            <p className="text-center text-sm text-gray-600">
              Don’t have an account?{" "}
              <a href="/auth/register" className="underline text-blue-600">
                Sign up
              </a>
            </p>
          </form>

          {/* Sosial Media */}
          <div className="text-center mt-6 space-x-4">
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
      <div className="absolute bottom-2 right-4 text-xs text-gray-400 border border-gray-300 px-3 py-1 rounded-full bg-white/70 backdrop-blur-sm shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md hover:bg-white">
        Version {appVersion}
      </div>
    </div>
  );
};

export default LoginPage;
