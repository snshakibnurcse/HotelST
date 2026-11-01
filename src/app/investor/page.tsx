import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getDashboardMetricsAction, DateFilterType } from "@/actions/financials";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { redirect } from "next/navigation";

interface InvestorPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InvestorDashboardPage({ searchParams }: InvestorPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const filter = (sp?.filter as DateFilterType) || "this_month";
  const customStart = sp?.start as string | undefined;
  const customEnd = sp?.end as string | undefined;

  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">No Investor Access Configured</h2>
        <p className="text-xs text-slate-500 mt-2">
          Your account is not currently assigned viewing permissions to any active hotel. Please contact the administrator.
        </p>
      </div>
    );
  }

  const selectedHotelId = (sp?.hotelId as string) || "ALL";
  const activeHotel = authorizedHotels.find((h) => h.id === selectedHotelId);
  const hotelDisplayName = activeHotel ? activeHotel.name : "All Authorized Hotels (Consolidated Portfolio)";

  const metrics = await getDashboardMetricsAction({
    hotelId: selectedHotelId,
    dateFilter: filter,
    customStart,
    customEnd,
  });

  if (!metrics) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">No Data Available</h2>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Read-Only Notice Banner */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
        <span className="font-semibold">
          Investor Partner Portal — Read-Only Portfolio & Performance View
        </span>
        <span className="text-[11px] font-mono bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-bold">
          AUDIT COMPLIANT
        </span>
      </div>

      <DashboardView
        metrics={{
          ...metrics,
          recentReservations: metrics.recentReservations.map((r) => ({
            ...r,
            totalAmount: Number(r.totalAmount),
          })),
          recentPayments: metrics.recentPayments.map((p) => ({
            ...p,
            amount: Number(p.amount),
          })),
        }}
        hotelName={hotelDisplayName}
        isInvestor={true}
      />
    </div>
  );
}
