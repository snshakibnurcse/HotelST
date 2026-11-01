"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Filter, FileBarChart } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface ReportDataProps {
  hotelName: string;
  period: { start: string; end: string; filter: string };
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
  expenseBreakdown: Array<{ name: string; value: number }>;
  paymentBreakdown: Array<{ method: string; total: number }>;
}

export function FinancialReportsView({
  hotelName,
  period,
  financials,
  expenseBreakdown,
  paymentBreakdown,
}: ReportDataProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [dateFilter, setDateFilter] = React.useState(period.filter || "this_month");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", dateFilter);
    if (dateFilter === "custom" && customStart && customEnd) {
      params.set("start", customStart);
      params.set("end", customEnd);
    } else {
      params.delete("start");
      params.delete("end");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const exportCsv = () => {
    const rows = [
      ["FINANCIAL AUDIT REPORT", hotelName],
      ["Period", `${formatDate(period.start)} to ${formatDate(period.end)}`],
      [],
      ["FINANCIAL METRIC", "AMOUNT (BDT)"],
      ["Total Invoiced Room Revenue", financials.recognizedRoomRevenue],
      ["Total Folio Invoiced", financials.periodTotalInvoiced],
      ["Other Operating Income", financials.totalOtherIncome],
      ["Total Gross Revenue", financials.totalRevenue],
      ["Actual Collected Cash Payments", financials.collectedCashPayments],
      ["Operating Expenses", financials.totalExpenses],
      ["Net Operating Result", financials.netOperatingResult],
      ["Guest Accounts Receivable (Outstanding)", financials.outstandingGuestBalances],
      [],
      ["EXPENSE BREAKDOWN BY CATEGORY", "AMOUNT (BDT)"],
      ...expenseBreakdown.map((e) => [e.name, e.value]),
      [],
      ["COLLECTIONS BY PAYMENT CHANNEL", "AMOUNT (BDT)"],
      ...paymentBreakdown.map((p) => [p.method, p.total]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Financial_Report_${hotelName.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Financial Analytics & Executive Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-backed reporting for {hotelName} ({formatDate(period.start)} → {formatDate(period.end)})
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-1.5" />
          Export Report (CSV)
        </Button>
      </div>

      {/* Date Range Selector */}
      <form onSubmit={handleApplyFilter} className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          Report Period:
        </div>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
          <option value="previous_month">Previous Month</option>
          <option value="custom">Custom Date Range</option>
        </select>

        {dateFilter === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              required
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              required
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>
        )}

        <Button type="submit" variant="secondary" size="sm">
          Update Report
        </Button>
      </form>

      {/* Financial Statement Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold text-slate-900">
            Statement of Operations & Liquidity Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2.5 flex justify-between font-medium text-slate-700">
              <span>Gross Recognized Invoiced Revenue (Folios)</span>
              <span className="font-bold text-slate-900">{formatCurrency(financials.periodTotalInvoiced)}</span>
            </div>
            <div className="py-2.5 flex justify-between font-medium text-slate-700">
              <span>Other Operating Income (Events, Direct Sales)</span>
              <span className="font-bold text-slate-900">{formatCurrency(financials.totalOtherIncome)}</span>
            </div>
            <div className="py-2.5 flex justify-between font-bold text-slate-900 bg-slate-50 px-2 rounded">
              <span>Total Recognized Revenue</span>
              <span className="font-extrabold">{formatCurrency(financials.totalRevenue)}</span>
            </div>
            <div className="py-2.5 flex justify-between font-medium text-slate-700">
              <span>Operating Expenses (Salaries, Utilities, Supplies)</span>
              <span className="font-bold text-rose-700">- {formatCurrency(financials.totalExpenses)}</span>
            </div>
            <div className="py-3 flex justify-between font-extrabold text-sm border-t-2 border-slate-900 bg-slate-100/70 px-2 rounded">
              <span>Net Operating Result (EBITDA)</span>
              <span className={financials.netOperatingResult >= 0 ? "text-emerald-700" : "text-rose-700"}>
                {formatCurrency(financials.netOperatingResult)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">Category-Wise Operating Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">Expense Category</th>
                  <th className="pb-2 font-semibold text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenseBreakdown.map((exp) => (
                  <tr key={exp.name}>
                    <td className="py-2 font-medium text-slate-800">{exp.name}</td>
                    <td className="py-2 font-bold text-rose-700 text-right">{formatCurrency(exp.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Collections by Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">Collected Cash & Digital Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">Payment Channel</th>
                  <th className="pb-2 font-semibold text-right">Collected Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentBreakdown.map((pay) => (
                  <tr key={pay.method}>
                    <td className="py-2 font-medium text-slate-800">{pay.method}</td>
                    <td className="py-2 font-bold text-emerald-700 text-right">{formatCurrency(pay.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
