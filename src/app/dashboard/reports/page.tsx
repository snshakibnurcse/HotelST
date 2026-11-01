import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getDashboardMetricsAction, DateFilterType } from "@/actions/financials";
import { FinancialReportsView } from "@/components/reports/FinancialReportsView";
import { redirect } from "next/navigation";

interface ReportsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const filter = (sp?.filter as DateFilterType) || "this_month";
  const customStart = sp?.start as string | undefined;
  const customEnd = sp?.end as string | undefined;

  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) return <div className="p-8">No hotel assigned.</div>;

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;
  const activeHotel = authorizedHotels.find((h) => h.id === selectedHotelId);

  const metrics = await getDashboardMetricsAction({
    hotelId: selectedHotelId,
    dateFilter: filter,
    customStart,
    customEnd,
  });

  if (!metrics) return <div className="p-8">No report data found.</div>;

  return (
    <FinancialReportsView
      hotelName={activeHotel ? activeHotel.name : "Portfolio Consolidated"}
      period={metrics.period}
      financials={metrics.financials}
      expenseBreakdown={metrics.expenseBreakdown}
      paymentBreakdown={metrics.paymentBreakdown}
    />
  );
}
