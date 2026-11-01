"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { recordPaymentAction, getInvoiceDetailsAction } from "@/actions/billing";
import { generateInvoicePdf } from "@/lib/pdf-invoice";
import { Receipt, Search, Download, CreditCard, ShieldAlert, CheckCircle, Plus } from "lucide-react";
import { PaymentMethod, InvoiceStatus } from "@prisma/client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  issueDate: Date | string;
  status: InvoiceStatus;
  subtotal: number | { toString(): string };
  discountAmount: number | { toString(): string };
  taxAmount: number | { toString(): string };
  totalAmount: number | { toString(): string };
  paidAmount: number | { toString(): string };
  outstandingBalance: number | { toString(): string };
  guest: { fullName: string; mobile: string };
  reservation?: {
    reservationNumber: string;
    checkInDate: Date | string;
    checkOutDate: Date | string;
    room: { roomNumber: string };
  } | null;
}

interface InvoicesListViewProps {
  hotelId: string;
  invoices: InvoiceListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  isReadOnly?: boolean;
}

export function InvoicesListView({ hotelId, invoices, pagination, isReadOnly = false }: InvoicesListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = React.useState(searchParams.get("status") || "ALL");

  // Payment Recording Modal State
  const [payingInvoice, setPayingInvoice] = React.useState<InvoiceListItem | null>(null);
  const [payAmount, setPayAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>(PaymentMethod.CASH);
  const [txRef, setTxRef] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isRecordingPay, setIsRecordingPay] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);

  // PDF Generating indicator
  const [generatingPdfId, setGeneratingPdfId] = React.useState<string | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    else params.delete("status");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    setGeneratingPdfId(invoiceId);
    try {
      const fullInvoice = await getInvoiceDetailsAction(hotelId, invoiceId);
      generateInvoicePdf({
        invoiceNumber: fullInvoice.invoiceNumber,
        issueDate: fullInvoice.issueDate,
        dueDate: fullInvoice.dueDate,
        status: fullInvoice.status,
        hotel: {
          name: fullInvoice.hotel.name,
          code: fullInvoice.hotel.code,
          address: fullInvoice.hotel.address,
          city: fullInvoice.hotel.city,
          phone: fullInvoice.hotel.phone,
          email: fullInvoice.hotel.email,
          currency: fullInvoice.hotel.currency,
        },
        guest: {
          fullName: fullInvoice.guest.fullName,
          mobile: fullInvoice.guest.mobile,
          email: fullInvoice.guest.email,
          address: fullInvoice.guest.address,
        },
        reservation: fullInvoice.reservation
          ? {
              reservationNumber: fullInvoice.reservation.reservationNumber,
              checkInDate: fullInvoice.reservation.checkInDate,
              checkOutDate: fullInvoice.reservation.checkOutDate,
              totalNights: fullInvoice.reservation.totalNights,
              roomNumber: fullInvoice.reservation.room.roomNumber,
              roomType: fullInvoice.reservation.room.roomType.name,
            }
          : null,
        items: fullInvoice.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          totalPrice: Number(it.totalPrice),
        })),
        subtotal: Number(fullInvoice.subtotal),
        discountAmount: Number(fullInvoice.discountAmount),
        additionalCharges: Number(fullInvoice.additionalCharges),
        taxAmount: Number(fullInvoice.taxAmount),
        totalAmount: Number(fullInvoice.totalAmount),
        paidAmount: Number(fullInvoice.paidAmount),
        outstandingBalance: Number(fullInvoice.outstandingBalance),
        payments: fullInvoice.payments.map((p) => ({
          paymentNumber: p.paymentNumber,
          amount: Number(p.amount),
          method: p.method,
          paymentDate: p.paymentDate,
          transactionRef: p.transactionRef,
        })),
      });
    } catch {
      alert("Failed to compile PDF invoice");
    } finally {
      setGeneratingPdfId(null);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;

    setIsRecordingPay(true);
    setPayError(null);

    const res = await recordPaymentAction(hotelId, {
      invoiceId: payingInvoice.id,
      amount: parseFloat(payAmount) || 0,
      method,
      transactionRef: txRef || undefined,
      notes: notes || undefined,
    });

    setIsRecordingPay(false);
    if (res.success) {
      setPayingInvoice(null);
      router.refresh();
    } else {
      setPayError(res.error || "Payment recording failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Billing, Invoices & Folio Settlements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-compliant billing records, multi-method payments, and client PDF invoice generation.
          </p>
        </div>
      </div>

      {/* Filter / Search */}
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, guest name, phone..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          <option value="ALL">All Invoices</option>
          <option value="ISSUED">Issued / Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid in Full</option>
          <option value="VOIDED">Voided</option>
        </select>

        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
      </form>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Invoice #</th>
                  <th className="py-3 px-4 font-semibold">Guest</th>
                  <th className="py-3 px-4 font-semibold">Stay / Room</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Total Amount</th>
                  <th className="py-3 px-4 font-semibold">Paid Amount</th>
                  <th className="py-3 px-4 font-semibold">Balance Due</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">{inv.guest.fullName}</span>
                      <span className="text-[10px] text-slate-400 block">{inv.guest.mobile}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {inv.reservation ? (
                        <span>Room {inv.reservation.room.roomNumber} ({inv.reservation.reservationNumber})</span>
                      ) : (
                        <span>Non-Room Folio</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(inv.issueDate)}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 font-medium text-emerald-700">
                      {formatCurrency(inv.paidAmount)}
                    </td>
                    <td className="py-3 px-4">
                      {Number(inv.outstandingBalance) > 0 ? (
                        <span className="font-bold text-rose-600">
                          {formatCurrency(inv.outstandingBalance)}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600">Settled (0.00)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === "PARTIALLY_PAID"
                            ? "bg-amber-100 text-amber-800"
                            : inv.status === "ISSUED"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {inv.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadPdf(inv.id)}
                          disabled={generatingPdfId === inv.id}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] cursor-pointer inline-flex items-center gap-1"
                          title="Generate & Download PDF Invoice"
                        >
                          <Download className="w-3 h-3 text-[#0F2744]" />
                          PDF
                        </button>

                        {!isReadOnly && Number(inv.outstandingBalance) > 0 && inv.status !== "VOIDED" && (
                          <button
                            onClick={() => {
                              setPayingInvoice(inv);
                              setPayAmount(Number(inv.outstandingBalance).toString());
                              setPayError(null);
                            }}
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] cursor-pointer inline-flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            Record Payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      {payingInvoice && (
        <Modal
          isOpen={!!payingInvoice}
          onClose={() => setPayingInvoice(null)}
          title={`Record Payment for ${payingInvoice.invoiceNumber}`}
          description={`Guest: ${payingInvoice.guest.fullName} • Balance Due: ${formatCurrency(payingInvoice.outstandingBalance)}`}
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            {payError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Payment Amount (BDT)"
                type="number"
                step="0.01"
                min="0.01"
                max={Number(payingInvoice.outstandingBalance)}
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Payment Channel</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="BKASH">bKash Merchant</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="CARD_POS">Card / POS</option>
                  <option value="BANK_TRANSFER">Bank Wire</option>
                </select>
              </div>
            </div>

            <Input
              label="Transaction ID / Voucher Reference (Optional)"
              placeholder="e.g. TRX1928374 or Slip #"
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
            />

            <Input
              label="Audited Payment Notes (Optional)"
              placeholder="e.g. Received at cashier desk"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setPayingInvoice(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isRecordingPay}>
                Confirm & Apply Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
