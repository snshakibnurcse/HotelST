import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getInvoicesAction } from "@/actions/billing";
import { InvoicesListView } from "@/components/billing/InvoicesListView";
import { InvoiceStatus } from "@prisma/client";
import { redirect } from "next/navigation";

interface InvoicesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) return <div className="p-8">No hotel assigned.</div>;

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;
  const search = sp?.search as string | undefined;
  const statusFilter = sp?.status && sp.status !== "ALL" ? (sp.status as InvoiceStatus) : undefined;

  const invoiceData = await getInvoicesAction(selectedHotelId, {
    status: statusFilter,
    search,
  });

  return (
    <InvoicesListView
      hotelId={selectedHotelId}
      invoices={invoiceData.items.map((inv) => ({
        ...inv,
        subtotal: Number(inv.subtotal),
        discountAmount: Number(inv.discountAmount),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        outstandingBalance: Number(inv.outstandingBalance),
      }))}
      pagination={invoiceData.pagination}
      isReadOnly={false}
    />
  );
}
