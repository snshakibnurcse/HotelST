"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  BookCheck,
  UserCheck,
  UserMinus,
  Users,
  Receipt,
  CircleDollarSign,
  FileBarChart,
  Settings,
  Shield,
  Building2,
  Lock,
} from "lucide-react";

interface SidebarProps {
  role: "ADMIN" | "MANAGER" | "INVESTOR";
  hotelId?: string;
}

export function Sidebar({ role, hotelId }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hotelParam = hotelId ? `?hotelId=${hotelId}` : "";

  // Helper to preserve active hotelId query parameter in links
  const getHref = (basePath: string) => {
    const curHotel = searchParams.get("hotelId") || hotelId;
    return curHotel ? `${basePath}?hotelId=${curHotel}` : basePath;
  };

  const managerLinks = [
    { label: "Dashboard", href: getHref("/dashboard"), icon: LayoutDashboard },
    { label: "Room Board", href: getHref("/dashboard/room-board"), icon: CalendarDays },
    { label: "Rooms & Inventory", href: getHref("/dashboard/rooms"), icon: BedDouble },
    { label: "Reservations", href: getHref("/dashboard/reservations"), icon: BookCheck },
    { label: "Check-In", href: getHref("/dashboard/check-in"), icon: UserCheck },
    { label: "Check-Out", href: getHref("/dashboard/check-out"), icon: UserMinus },
    { label: "Guest Directory", href: getHref("/dashboard/guests"), icon: Users },
    { label: "Invoices & Billing", href: getHref("/dashboard/invoices"), icon: Receipt },
    { label: "Income & Expenses", href: getHref("/dashboard/financials"), icon: CircleDollarSign },
    { label: "Reports & Exports", href: getHref("/dashboard/reports"), icon: FileBarChart },
    { label: "Hotel Settings", href: getHref("/dashboard/settings"), icon: Settings },
  ];

  const adminLinks = [
    { label: "System Overview", href: "/admin", icon: Shield },
    { label: "Hotel Directory", href: "/admin/hotels", icon: Building2 },
    { label: "User Management", href: "/admin/users", icon: Users },
    { label: "Audit Logs", href: "/admin/audit", icon: Receipt },
    { label: "Manager Dashboard", href: getHref("/dashboard"), icon: LayoutDashboard },
  ];

  const investorLinks = [
    { label: "Portfolio Analytics", href: getHref("/investor"), icon: LayoutDashboard },
    { label: "Room Availability", href: getHref("/investor/room-board"), icon: CalendarDays },
    { label: "Reservations (Read)", href: getHref("/investor/reservations"), icon: BookCheck },
    { label: "Invoices & Revenue", href: getHref("/investor/invoices"), icon: Receipt },
    { label: "Financial Reports", href: getHref("/investor/reports"), icon: FileBarChart },
  ];

  let links = managerLinks;
  if (role === "ADMIN") links = adminLinks;
  if (role === "INVESTOR") links = investorLinks;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      {/* Role banner */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
          {role === "ADMIN" ? "Administrator" : role === "INVESTOR" ? "Investor View" : "Hotel Manager"}
        </span>
        {role === "INVESTOR" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
            <Lock className="w-2.5 h-2.5" />
            READ ONLY
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href.split("?")[0];
          return (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group",
                isActive
                  ? "bg-[#C59B27] text-white font-semibold shadow-xs"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer support */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400">
        <p className="font-medium text-slate-300">Grand Horizon v1.0</p>
        <p className="mt-0.5 text-slate-400">MySQL Database Active</p>
      </div>
    </aside>
  );
}
