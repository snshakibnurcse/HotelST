"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { checkInGuestAction } from "@/actions/reservations";
import { UserCheck, Search, ShieldAlert, ArrowRight, CreditCard, Building2 } from "lucide-react";
import { PaymentMethod } from "@prisma/client";
import { useRouter } from "next/navigation";

interface EligibleReservation {
  id: string;
  reservationNumber: string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  totalNights: number;
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  guest: { fullName: string; mobile: string };
  room: { roomNumber: string; type: string };
}

interface CheckInWorkflowViewProps {
  hotelId: string;
  eligibleReservations: EligibleReservation[];
}

export function CheckInWorkflowView({ hotelId, eligibleReservations }: CheckInWorkflowViewProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [selectedRes, setSelectedRes] = React.useState<EligibleReservation | null>(null);

  // Check-in modal form
  const [collectAmount, setCollectAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>(PaymentMethod.CASH);
  const [ref, setRef] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const filtered = eligibleReservations.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.reservationNumber.toLowerCase().includes(q) ||
      r.guest.fullName.toLowerCase().includes(q) ||
      r.guest.mobile.includes(q) ||
      r.room.roomNumber.includes(q)
    );
  });

  const handleOpenCheckInModal = (res: EligibleReservation) => {
    setSelectedRes(res);
    setCollectAmount(res.outstandingBalance > 0 ? res.outstandingBalance.toString() : "0");
    setRef("");
    setErrorMsg(null);
  };

  const handleConfirmCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRes) return;

    setIsProcessing(true);
    setErrorMsg(null);

    const amountNum = parseFloat(collectAmount) || 0;
    const res = await checkInGuestAction(
      hotelId,
      selectedRes.id,
      amountNum > 0 ? { amount: amountNum, method, ref } : undefined
    );

    setIsProcessing(false);
    if (res.success) {
      setSelectedRes(null);
      router.push("/dashboard/room-board");
      router.refresh();
    } else {
      setErrorMsg(res.error || "Failed to check in guest");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          Front Desk Guest Check-In
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Verify guest identity, collect desk advance payments, and register room occupancy.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search arriving guests by name, phone, room, or res #..."
          className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        />
      </div>

      {/* Arriving Stays Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((res) => (
          <Card key={res.id} className="hover:border-slate-400 transition-all shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{res.guest.fullName}</span>
                  <span className="text-[11px] text-slate-500">{res.guest.mobile}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-[#0F2744] block">
                    Room {res.room.roomNumber}
                  </span>
                  <span className="text-[10px] text-slate-400">{res.room.type}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Res #:</span>
                  <span className="font-semibold text-slate-800">{res.reservationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stay Duration:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)} ({res.totalNights}n)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Stay Bill:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(res.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Balance Due:</span>
                  <span className={`font-bold ${res.outstandingBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {res.outstandingBalance > 0 ? formatCurrency(res.outstandingBalance) : "Settled"}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => handleOpenCheckInModal(res)}
              >
                <UserCheck className="w-4 h-4 mr-1.5" />
                Process Arrival & Check-In
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-sm font-semibold text-slate-700">No confirmed bookings waiting for check-in.</p>
        </div>
      )}

      {/* Check-In Modal */}
      {selectedRes && (
        <Modal
          isOpen={!!selectedRes}
          onClose={() => setSelectedRes(null)}
          title={`Check-In: ${selectedRes.guest.fullName}`}
          description={`Room #${selectedRes.room.roomNumber} (${selectedRes.room.type}) • ${selectedRes.reservationNumber}`}
        >
          <form onSubmit={handleConfirmCheckIn} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Stay Bill Total:</span>
                <span className="font-bold text-slate-900">{formatCurrency(selectedRes.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Advance Already Paid:</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(selectedRes.paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-700 font-semibold">Remaining Balance:</span>
                <span className="font-extrabold text-rose-700">{formatCurrency(selectedRes.outstandingBalance)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Collect Payment at Arrival Desk (Optional)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  label="Collection Amount (BDT)"
                  type="number"
                  min="0"
                  max={selectedRes.outstandingBalance}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                />
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Payment Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                    <option value="CARD_POS">Card / POS</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
              </div>
              <Input
                label="Transaction Ref / Voucher No"
                placeholder="e.g. Receipt # or bKash Trx"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedRes(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isProcessing}>
                Confirm Guest Check-In
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
