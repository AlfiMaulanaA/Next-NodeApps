"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import api from "@/lib/api-service";
import Swal from "sweetalert2";
import { Eye, EyeOff } from "lucide-react";

const RegisterPage = () => {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("");
  const [passwordStrengthColor, setPasswordStrengthColor] = useState("text-gray-400");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !email || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (passwordStrength === "Weak") {
      setError("Password is too weak. Please use a stronger password.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/users/register", { username, email, password });
      Swal.fire({
        icon: "success",
        title: "Registration Successful",
        text: "You can now login!",
        showConfirmButton: false,
        timer: 1500,
      }).then(() => {
        router.push("/auth/login");
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || "Something went wrong";
      setError(message);
    }
    setLoading(false);
  };

  // Password strength checker
  const checkPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 2) {
      setPasswordStrength("Weak");
      setPasswordStrengthColor("text-red-500");
    } else if (score === 3 || score === 4) {
      setPasswordStrength("Medium");
      setPasswordStrengthColor("text-yellow-500");
    } else if (score === 5) {
      setPasswordStrength("Strong");
      setPasswordStrengthColor("text-green-600");
    } else {
      setPasswordStrength("");
      setPasswordStrengthColor("text-gray-400");
    }
    return score;
  };

  return (
    <div className="flex min-h-screen font-sans bg-gray-100">
      <div
        className="flex-1 relative bg-cover bg-center overflow-hidden hidden lg:block"
        style={{ backgroundImage: "url(/images/border-device.png)" }}
      >
        <div
          className="absolute inset-0 bg-black/60 p-8 m-8 rounded-2xl flex flex-col justify-between animate-fadeInLeft"
          style={{ clipPath: "polygon(0 0, 80% 0, 100% 100%, 0% 100%)" }}
        >
          <div className="flex items-center gap-2 text-white animate-fadeInUp">
            <Image src="/images/gspe.jpg" alt="GSPE" width={40} height={40} className="rounded-full" />
            <div>
              <p className="font-bold leading-tight">PT Graha Sumber Prima Elektronik</p>
              <p className="text-white/70 text-sm leading-tight">Manufactur Electrical Panel & Internet Of Things</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-6 animate-slideIn py-12">
          <div>
            <h2 className="text-3xl font-bold text-center text-gray-900 animate-fadeInUp">Create your account</h2>
            <p className="text-center text-gray-500 mt-2 text-sm">
              <span className="inline-block border-r-2 border-blue-500 pr-2 animate-typing overflow-hidden whitespace-nowrap" style={{animation: 'typing 2.5s steps(30, end), blink-caret .75s step-end infinite'}}>
                Sign up to access the Nodes MQTT Gateway Software
              </span>
            </p>
          </div>
          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Enter your username" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Enter your email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    checkPasswordStrength(e.target.value);
                  }}
                  required
                  placeholder="Enter your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  {passwordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {password && (
                <>
                  <div className={`mt-1 text-xs font-semibold ${passwordStrengthColor}`}>Password strength : {passwordStrength}</div>
                  <div className="w-full h-2 mt-1 rounded bg-gray-200 overflow-hidden">
                    <div
                      className={
                        `h-full transition-all duration-300 ` +
                        (passwordStrength === "Weak"
                          ? "bg-red-500"
                          : passwordStrength === "Medium"
                          ? "bg-yellow-400"
                          : passwordStrength === "Strong"
                          ? "bg-green-600"
                          : "bg-gray-300")
                      }
                      style={{ width: `${
                        passwordStrength === "Weak"
                          ? 33
                          : passwordStrength === "Medium"
                          ? 66
                          : passwordStrength === "Strong"
                          ? 100
                          : 0
                      }%` }}
                    />
                  </div>
                </>
              )}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={confirmPasswordVisible ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 focus:outline-none"
                  tabIndex={-1}
                  aria-label={confirmPasswordVisible ? "Hide password" : "Show password"}
                >
                  {confirmPasswordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Registering...
                </span>
              ) : (
                "Register"
              )}
            </Button>
            {error && <div className="text-center text-red-500 text-sm mt-2">{error}</div>}
            <p className="text-center text-sm text-gray-600">
              Already have an account? <a href="/auth/login" className="underline text-blue-600">Login</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
