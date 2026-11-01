"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BedDouble,
  DoorOpen,
  CalendarCheck,
  UserCheck,
  UserMinus,
  TrendingUp,
  CreditCard,
  AlertCircle,
  Percent,
  Calendar,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface DashboardMetricsProps {
  metrics: {
    period: {
      filter: string;
      start: string;
      end: string;
    };
    rooms: {
      total: number;
      available: number;
      occupied: number;
      maintenance: number;
      occupancyPercentage: number;
      todayArrivals: number;
      todayDepartures: number;
    };
    financials: {
      recognizedRoomRevenue: number;
      periodTotalInvoiced: number;
      totalOtherIncome: number;
      totalRevenue: number;
      collectedCashPayments: number;
      totalExpenses: number;
      netOperatingResult: number;
      outstandingGuestBalances: number;
    };
    recentReservations: Array<{
      id: string;
      reservationNumber: string;
      checkInDate: Date | string;
      checkOutDate: Date | string;
      totalAmount: number | { toString(): string };
      status: string;
      guest: { fullName: string; mobile: string };
      room: { roomNumber: string };
    }>;
    recentPayments: Array<{
      id: string;
      paymentNumber: string;
      amount: number | { toString(): string };
      method: string;
      paymentDate: Date | string;
      reservation?: { guest?: { fullName: string } } | null;
    }>;
    expenseBreakdown: Array<{ name: string; value: number }>;
    paymentBreakdown: Array<{ method: string; total: number }>;
  };
  hotelName?: string;
  isInvestor?: boolean;
}

const PIE_COLORS = ["#0F2744", "#C59B27", "#059669", "#DC2626", "#7C3AED", "#2563EB", "#D97706", "#475569"];

export function DashboardView({ metrics, hotelName = "All Hotels", isInvestor = false }: DashboardMetricsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentFilter = searchParams.get("filter") || metrics.period.filter || "this_month";

  const handleFilterClick = (filterVal: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", filterVal);
    router.push(`${pathname}?${params.toString()}`);
  };

  const filterButtons = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "This Week", value: "this_week" },
    { label: "This Month", value: "this_month" },
    { label: "Previous Month", value: "previous_month" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            {hotelName} Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Displaying real-time database transactions for period:{" "}
            <span className="font-semibold text-slate-700">
              {formatDate(metrics.period.start)} to {formatDate(metrics.period.end)}
            </span>
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-none">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => handleFilterClick(btn.value)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                currentFilter === btn.value
                  ? "bg-[#0F2744] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total & Available Rooms */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Available Rooms</span>
              <DoorOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.rooms.available}</span>
              <span className="text-[10px] sm:text-xs text-slate-500 font-medium">/ {metrics.rooms.total}</span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
              {metrics.rooms.occupied} Occ • {metrics.rooms.maintenance} Maint.
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Rate */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Occupancy Rate</span>
              <Percent className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold text-slate-900">{metrics.rooms.occupancyPercentage}%</span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
              Today: {metrics.rooms.todayArrivals} in • {metrics.rooms.todayDepartures} out
            </div>
          </CardContent>
        </Card>

        {/* Total Invoiced Revenue */}
        <Card className="border-l-4 border-l-[#C59B27]">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Recognized Revenue</span>
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C59B27] shrink-0" />
            </div>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-base sm:text-xl font-bold text-slate-900 truncate block">
                {formatCurrency(metrics.financials.totalRevenue)}
              </span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
              Cash: {formatCurrency(metrics.financials.collectedCashPayments)}
            </div>
          </CardContent>
        </Card>

        {/* Net Operating Result */}
        <Card
          className={`border-l-4 ${
            metrics.financials.netOperatingResult >= 0 ? "border-l-emerald-600" : "border-l-rose-600"
          }`}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500">Net Result</span>
              <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 shrink-0" />
            </div>
            <div className="mt-1.5 sm:mt-2">
              <span
                className={`text-base sm:text-xl font-bold truncate block ${
                  metrics.financials.netOperatingResult >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {formatCurrency(metrics.financials.netOperatingResult)}
              </span>
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
              Exp: {formatCurrency(metrics.financials.totalExpenses)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Financial Snapshot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Total Collected Payments</span>
            <span className="text-lg font-bold text-emerald-700 block mt-0.5">
              {formatCurrency(metrics.financials.collectedCashPayments)}
            </span>
            <span className="text-[11px] text-slate-400">Actual liquidity received</span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Operating Expenses</span>
            <span className="text-lg font-bold text-rose-700 block mt-0.5">
              {formatCurrency(metrics.financials.totalExpenses)}
            </span>
            <span className="text-[11px] text-slate-400">Utilities, salaries, repairs</span>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-500 block">Guest Outstanding Balances</span>
            <span className="text-lg font-bold text-amber-700 block mt-0.5">
              {formatCurrency(metrics.financials.outstandingGuestBalances)}
            </span>
            <span className="text-[11px] text-slate-400">Accounts receivable</span>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses vs Net Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">
              Financial Operating Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Invoiced Revenue", amount: metrics.financials.totalRevenue },
                    { name: "Collected Cash", amount: metrics.financials.collectedCashPayments },
                    { name: "Expenses", amount: metrics.financials.totalExpenses },
                    { name: "Net Result", amount: metrics.financials.netOperatingResult },
                  ]}
                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val) || 0), "Amount"]}
                  />
                  <Bar dataKey="amount" fill="#0F2744" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expenses by Category Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">Expense Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {metrics.expenseBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {metrics.expenseBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatCurrency(Number(val) || 0), "Expense"]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No operating expenses recorded for this period.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables: Recent Stays & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Reservations */}
        <Card>
          <CardHeader className="p-3.5 sm:p-5 flex flex-row items-center justify-between border-b border-slate-100">
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-900">Recent Stays & Bookings</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {/* Mobile Card List (md:hidden) */}
            <div className="md:hidden space-y-2.5">
              {metrics.recentReservations.length > 0 ? (
                metrics.recentReservations.map((res) => (
                  <div
                    key={res.id}
                    className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">#{res.reservationNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          res.status === "CHECKED_IN"
                            ? "bg-emerald-100 text-emerald-800"
                            : res.status === "CONFIRMED"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {res.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-semibold">{res.guest.fullName}</span>
                      <span className="font-bold text-[#0F2744]">Room {res.room.roomNumber}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                      <span>{formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)}</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(res.totalAmount)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">No reservations found.</div>
              )}
            </div>

            {/* Desktop Table (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-2 font-semibold">Res #</th>
                    <th className="pb-2 font-semibold">Guest</th>
                    <th className="pb-2 font-semibold">Room</th>
                    <th className="pb-2 font-semibold">Dates</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.recentReservations.length > 0 ? (
                    metrics.recentReservations.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 font-semibold text-slate-800">{res.reservationNumber}</td>
                        <td className="py-2.5 text-slate-700">{res.guest.fullName}</td>
                        <td className="py-2.5 font-medium text-slate-600">Room {res.room.roomNumber}</td>
                        <td className="py-2.5 text-slate-500">{formatDate(res.checkInDate)}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              res.status === "CHECKED_IN"
                                ? "bg-emerald-100 text-emerald-800"
                                : res.status === "CONFIRMED"
                                ? "bg-sky-100 text-sky-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {res.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No reservations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Payment Receipts */}
        <Card>
          <CardHeader className="p-3.5 sm:p-5 flex flex-row items-center justify-between border-b border-slate-100">
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-900">Recent Payment Collections</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {/* Mobile Card List (md:hidden) */}
            <div className="md:hidden space-y-2.5">
              {metrics.recentPayments.length > 0 ? (
                metrics.recentPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{p.paymentNumber}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {formatDate(p.paymentDate)} • <span className="font-medium text-slate-700">{p.method}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-700 block">{formatCurrency(p.amount)}</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded font-semibold">
                        Received
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">No payments received yet.</div>
              )}
            </div>

            {/* Desktop Table (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-2 font-semibold">Receipt #</th>
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold">Method</th>
                    <th className="pb-2 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.recentPayments.length > 0 ? (
                    metrics.recentPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 font-semibold text-slate-800">{p.paymentNumber}</td>
                        <td className="py-2.5 text-slate-500">{formatDate(p.paymentDate)}</td>
                        <td className="py-2.5 font-medium text-slate-700">{p.method}</td>
                        <td className="py-2.5 text-right font-bold text-emerald-700">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        No payments received yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
