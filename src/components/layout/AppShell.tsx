"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth";
import {
  Building2,
  LogOut,
  ChevronDown,
  Menu,
  X,
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
  Lock,
  SlidersHorizontal,
} from "lucide-react";

export interface AuthorizedHotel {
  id: string;
  name: string;
  code: string;
  city: string;
}

export interface AppShellProps {
  currentUser: {
    userId: string;
    fullName: string;
    email: string;
    role: "ADMIN" | "MANAGER" | "INVESTOR";
  };
  authorizedHotels: AuthorizedHotel[];
  role: "ADMIN" | "MANAGER" | "INVESTOR";
  children: React.ReactNode;
}

export function AppShell({
  currentUser,
  authorizedHotels,
  role,
  children,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname, searchParams]);

  const selectedHotelId = searchParams.get("hotelId");

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

  const getHref = (basePath: string) => {
    const curHotel = searchParams.get("hotelId");
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

  // Bottom Navigation quick links for mobile
  const bottomNavItems =
    role === "INVESTOR"
      ? [
          { label: "Portfolio", href: getHref("/investor"), icon: LayoutDashboard },
          { label: "Rooms", href: getHref("/investor/room-board"), icon: CalendarDays },
          { label: "Bookings", href: getHref("/investor/reservations"), icon: BookCheck },
          { label: "Revenue", href: getHref("/investor/invoices"), icon: Receipt },
        ]
      : role === "ADMIN"
      ? [
          { label: "Overview", href: "/admin", icon: Shield },
          { label: "Hotels", href: "/admin/hotels", icon: Building2 },
          { label: "Users", href: "/admin/users", icon: Users },
          { label: "Manager", href: getHref("/dashboard"), icon: LayoutDashboard },
        ]
      : [
          { label: "Dashboard", href: getHref("/dashboard"), icon: LayoutDashboard },
          { label: "Rooms", href: getHref("/dashboard/room-board"), icon: CalendarDays },
          { label: "Check-In", href: getHref("/dashboard/check-in"), icon: UserCheck },
          { label: "Check-Out", href: getHref("/dashboard/check-out"), icon: UserMinus },
        ];

  const roleColors = {
    ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    MANAGER: "bg-blue-100 text-blue-800 border-blue-200",
    INVESTOR: "bg-amber-100 text-amber-800 border-amber-200",
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navbar */}
      <header className="h-14 sm:h-16 bg-white border-b border-slate-200 sticky top-0 z-40 px-3 sm:px-6 flex items-center justify-between">
        {/* Brand & Mobile Hamburger Toggle */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href={links[0]?.href || "/"} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0F2744] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4AF37]" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-sm tracking-tight text-slate-900 block leading-tight">
                Grand Horizon
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block leading-tight">
                Hotel Management
              </span>
            </div>
          </Link>

          {/* Hotel Selector */}
          {authorizedHotels.length > 0 && (
            <div className="relative flex items-center ml-1 sm:ml-3 max-w-[170px] sm:max-w-xs truncate">
              <select
                value={selectedHotelId || authorizedHotels[0]?.id || ""}
                onChange={handleHotelChange}
                className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-lg pl-2 sm:pl-3 pr-7 py-1 text-[11px] sm:text-xs font-semibold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-[#0F2744] cursor-pointer truncate"
              >
                {(currentUser.role === "ADMIN" || currentUser.role === "INVESTOR") && (
                  <option value="ALL">All Hotels (Consolidated)</option>
                )}
                {authorizedHotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* User Role Badge & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-900 leading-tight">{currentUser.fullName}</span>
            <span className="text-[11px] text-slate-500 leading-tight">{currentUser.email}</span>
          </div>

          <span
            className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wide uppercase border ${roleColors[currentUser.role]}`}
          >
            {currentUser.role}
          </span>

          <form action={logoutAction}>
            <button
              type="submit"
              title="Log out"
              className="p-1.5 sm:p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Body with Desktop Sidebar + Mobile Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Sidebar (visible on lg screens, hidden on mobile) */}
        <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-300 flex-col shrink-0 border-r border-slate-800">
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
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                    )}
                  />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400">
            <p className="font-medium text-slate-300">Grand Horizon HMS</p>
            <p className="mt-0.5 text-slate-500">Cloud Sync Active</p>
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer Navigation */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer Content */}
            <div className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-300 flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0F2744] text-[#D4AF37] flex items-center justify-center font-bold text-xs border border-white/10">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">Grand Horizon</span>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                      {role} PORTAL
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer User Info */}
              <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800/80">
                <p className="text-xs font-bold text-white truncate">{currentUser.fullName}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
              </div>

              {/* Drawer Links */}
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href.split("?")[0];
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all",
                        isActive
                          ? "bg-[#C59B27] text-white font-semibold shadow-xs"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Drawer Footer Logout */}
              <div className="p-3 border-t border-slate-800">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/30 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Main Content View with padding adapted for mobile and bottom navigation */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 pb-20 lg:pb-8 min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Thumb-friendly 1-tap shortcuts) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-slate-200 z-30 flex items-center justify-around px-1 shadow-lg backdrop-blur-md">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href.split("?")[0];
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors",
                isActive ? "text-[#0F2744] font-bold" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Icon className={cn("w-4 h-4 mb-0.5", isActive ? "text-[#0F2744] scale-110" : "text-slate-500")} />
              <span className="text-[10px] leading-tight truncate">{item.label}</span>
            </Link>
          );
        })}

        {/* More / All Menu Button */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4 mb-0.5 text-slate-500" />
          <span className="text-[10px] leading-tight">More</span>
        </button>
      </div>
    </div>
  );
}
