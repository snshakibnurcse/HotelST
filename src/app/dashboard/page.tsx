import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getDashboardMetricsAction, DateFilterType } from "@/actions/financials";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { redirect } from "next/navigation";

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
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
        <h2 className="text-lg font-bold text-slate-800">No Hotel Assigned</h2>
        <p className="text-xs text-slate-500 mt-2">
          Your account is not currently assigned to any active hotel. Please contact your System Administrator.
        </p>
      </div>
    );
  }

  // Pick requested hotelId or default to user's first assigned hotel
  let selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;
  if (selectedHotelId === "ALL" && session.role !== "ADMIN" && session.role !== "INVESTOR") {
    selectedHotelId = authorizedHotels[0]?.id;
  }

  const activeHotel = authorizedHotels.find((h) => h.id === selectedHotelId);
  const hotelDisplayName = activeHotel ? activeHotel.name : "Portfolio Consolidated";

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
      isInvestor={session.role === "INVESTOR"}
    />
  );
}
