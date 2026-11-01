"use client";

import * as React from "react";
import { logoutAction } from "@/actions/auth";
import { Building2, LogOut, User, Shield, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface NavbarProps {
  currentUser: {
    userId: string;
    fullName: string;
    email: string;
    role: "ADMIN" | "MANAGER" | "INVESTOR";
  };
  authorizedHotels: Array<{
    id: string;
    name: string;
    code: string;
    city: string;
  }>;
  selectedHotelId?: string;
}

export function Navbar({ currentUser, authorizedHotels, selectedHotelId }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleHotelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (val === "ALL" || !val) {
      params.delete("hotelId");
    } else {
      params.set("hotelId", val);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const roleColors = {
    ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    MANAGER: "bg-blue-100 text-blue-800 border-blue-200",
    INVESTOR: "bg-amber-100 text-amber-800 border-amber-200",
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
      {/* Brand & Active Hotel Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#0F2744] text-white flex items-center justify-center font-bold text-sm shadow-sm">
            <Building2 className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-sm tracking-tight text-slate-900 block leading-tight">
              Grand Horizon
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block leading-tight">
              Hotel Management System
            </span>
          </div>
        </div>

        {/* Hotel Selector (if user has access to multiple hotels or investor) */}
        {authorizedHotels.length > 0 && (
          <div className="relative flex items-center ml-2 sm:ml-4">
            <select
              value={selectedHotelId || authorizedHotels[0]?.id || ""}
              onChange={handleHotelChange}
              className="appearance-none bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#0F2744] cursor-pointer"
            >
              {(currentUser.role === "ADMIN" || currentUser.role === "INVESTOR") && (
                <option value="ALL">All Hotels (Consolidated Portfolio)</option>
              )}
              {authorizedHotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code} • {h.city})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 pointer-events-none" />
          </div>
        )}
      </div>

      {/* User profile & Logout */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex flex-col text-right">
          <span className="text-xs font-bold text-slate-900 leading-tight">{currentUser.fullName}</span>
          <span className="text-[11px] text-slate-500 leading-tight">{currentUser.email}</span>
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${roleColors[currentUser.role]}`}
        >
          {currentUser.role}
        </span>

        <form action={logoutAction}>
          <button
            type="submit"
            title="Log out"
            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
