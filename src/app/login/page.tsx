"use client";

import * as React from "react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Lock, Mail, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const result = await loginAction({ email, password });
    setIsLoading(false);

    if (result.success && result.redirectUrl) {
      router.push(result.redirectUrl);
      router.refresh();
    } else {
      setErrorMessage(result.error || "Login failed. Please check your credentials.");
    }
  };

  const fillQuickAccount = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle luxury ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#1E3A5F]/40 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C59B27] to-[#8C6D17] text-white shadow-lg mb-4 ring-4 ring-white/10">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Grand Horizon</h1>
          <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold mt-1">
            Enterprise Hotel Management System
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Multi-Hotel Operations • Real-time Folio Billing • Investor Portfolios
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 backdrop-blur-md">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter your business email and password</p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@sthotel.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F2744] focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F2744] focus:border-transparent transition"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" size="lg" className="w-full mt-2" isLoading={isLoading}>
              Sign In to Portal
            </Button>
          </form>

          {/* Quick Demo Credentials Switcher */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Quick Role Test Logins
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillQuickAccount("admin@sthotel.com", "Admin@123456")}
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition text-center cursor-pointer"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => fillQuickAccount("manager@sthotel.com", "Manager@123456")}
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition text-center cursor-pointer"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => fillQuickAccount("investor@sthotel.com", "Investor@123456")}
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition text-center cursor-pointer"
              >
                Investor
              </button>
            </div>
          </div>
        </div>

        {/* Security watermark */}
        <p className="text-center text-xs text-slate-500 mt-6 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          End-to-End Encrypted Session • MySQL Stored Data
        </p>
      </div>
    </div>
  );
}
