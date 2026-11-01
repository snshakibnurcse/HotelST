import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getFinancialTransactionsAction, getFinancialCategoriesAction } from "@/actions/financials";
import { FinancialsManagementView } from "@/components/financials/FinancialsManagementView";
import { redirect } from "next/navigation";

interface FinancialsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function FinancialsPage({ searchParams }: FinancialsPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) return <div className="p-8">No hotel assigned.</div>;

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;

  const [txData, categories] = await Promise.all([
    getFinancialTransactionsAction(selectedHotelId),
    getFinancialCategoriesAction(selectedHotelId),
  ]);

  return (
    <FinancialsManagementView
      hotelId={selectedHotelId}
      transactions={txData.items.map((t) => ({
        ...t,
        amount: Number(t.amount),
      }))}
      categories={categories}
      pagination={txData.pagination}
      isReadOnly={false}
    />
  );
}
