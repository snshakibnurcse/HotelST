"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { checkOutGuestAction, extendReservationAction } from "@/actions/reservations";
import { addInvoiceItemAction } from "@/actions/billing";
import {
  UserMinus,
  Search,
  CreditCard,
  ShieldAlert,
  Plus,
  CheckCircle,
  Receipt,
  CalendarPlus,
  AlertTriangle,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";
import { PaymentMethod, InvoiceItemType } from "@prisma/client";
import { useRouter } from "next/navigation";

interface OccupiedReservation {
  id: string;
  reservationNumber: string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  totalNights: number;
  nightlyRateSnapshot?: number;
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  guest: { fullName: string; mobile: string };
  room: { id: string; roomNumber: string; type: string };
  invoices: Array<{ id: string; invoiceNumber: string; status: string }>;
}

interface RoomOption {
  id: string;
  roomNumber: string;
  type: string;
  basePrice: number;
  status: string;
}

interface CheckOutWorkflowViewProps {
  hotelId: string;
  occupiedReservations: OccupiedReservation[];
  rooms?: RoomOption[];
}

export function CheckOutWorkflowView({ hotelId, occupiedReservations, rooms = [] }: CheckOutWorkflowViewProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [selectedRes, setSelectedRes] = React.useState<OccupiedReservation | null>(null);

  // Settlement Form State
  const [settlementAmount, setSettlementAmount] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>(PaymentMethod.CASH);
  const [ref, setRef] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Early Check-Out Adjustment state
  const [adjustEarlyCheckout, setAdjustEarlyCheckout] = React.useState(true);

  // Extend Stay Modal State
  const [extendingRes, setExtendingRes] = React.useState<OccupiedReservation | null>(null);
  const [extensionDate, setExtensionDate] = React.useState("");
  const [extensionRoomId, setExtensionRoomId] = React.useState("");
  const [isExtending, setIsExtending] = React.useState(false);
  const [extendError, setExtendError] = React.useState<string | null>(null);

  // Add Incidentals / Mini-bar Charge state
  const [showAddCharge, setShowAddCharge] = React.useState(false);
  const [chargeDesc, setChargeDesc] = React.useState("");
  const [chargeType, setChargeType] = React.useState<InvoiceItemType>(InvoiceItemType.FOOD_BEVERAGE);
  const [chargeQty, setChargeQty] = React.useState("1");
  const [chargePrice, setChargePrice] = React.useState("");
  const [isAddingCharge, setIsAddingCharge] = React.useState(false);

  const filtered = occupiedReservations.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.reservationNumber.toLowerCase().includes(q) ||
      r.guest.fullName.toLowerCase().includes(q) ||
      r.guest.mobile.includes(q) ||
      r.room.roomNumber.includes(q)
    );
  });

  const handleOpenCheckoutModal = (res: OccupiedReservation) => {
    setSelectedRes(res);
    setAdjustEarlyCheckout(true);

    const now = new Date();
    const inDate = new Date(res.checkInDate);
    const schedOut = new Date(res.checkOutDate);
    const inNorm = new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
    const nowNorm = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const schedNorm = new Date(schedOut.getFullYear(), schedOut.getMonth(), schedOut.getDate());

    const isEarly = nowNorm.getTime() < schedNorm.getTime();
    const actualStayNights = Math.max(1, Math.round((nowNorm.getTime() - inNorm.getTime()) / (1000 * 60 * 60 * 24)));
    const unstayedNights = Math.max(0, res.totalNights - actualStayNights);
    const approxRate = res.nightlyRateSnapshot || (res.totalNights > 0 ? res.totalAmount / res.totalNights : 0);
    const deduction = unstayedNights * approxRate;

    const initialDue = isEarly && unstayedNights > 0
      ? Math.max(0, res.totalAmount - deduction - res.paidAmount)
      : res.outstandingBalance;

    setSettlementAmount(initialDue.toString());
    setRef("");
    setNotes("");
    setShowAddCharge(false);
    setErrorMsg(null);
  };

  const handleOpenExtendModal = (res: OccupiedReservation) => {
    setExtendingRes(res);
    const schedOut = new Date(res.checkOutDate);
    schedOut.setDate(schedOut.getDate() + 1);
    setExtensionDate(schedOut.toISOString().slice(0, 10));
    setExtensionRoomId(res.room.id);
    setExtendError(null);
  };

  const handleConfirmExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingRes || !extensionDate) return;

    setIsExtending(true);
    setExtendError(null);

    const res = await extendReservationAction(hotelId, extendingRes.id, {
      newCheckOutDateStr: extensionDate,
      targetRoomId: extensionRoomId !== extendingRes.room.id ? extensionRoomId : undefined,
    });

    setIsExtending(false);

    if (res.success) {
      setExtendingRes(null);
      router.refresh();
    } else {
      setExtendError("error" in res ? (res.error as string) : "Failed to extend stay");
    }
  };

  const handleAddIncidental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRes || selectedRes.invoices.length === 0) return;

    setIsAddingCharge(true);
    const invoiceId = selectedRes.invoices[0].id;
    const res = await addInvoiceItemAction(hotelId, invoiceId, {
      description: chargeDesc,
      type: chargeType,
      quantity: parseInt(chargeQty) || 1,
      unitPrice: parseFloat(chargePrice) || 0,
    });

    setIsAddingCharge(false);
    if (res.success && res.invoice) {
      const updatedTotal = Number(res.invoice.totalAmount);
      const updatedBal = Number(res.invoice.outstandingBalance);
      setSelectedRes({
        ...selectedRes,
        totalAmount: updatedTotal,
        outstandingBalance: updatedBal,
      });
      setSettlementAmount(updatedBal.toString());
      setShowAddCharge(false);
      setChargeDesc("");
      setChargePrice("");
    } else {
      alert(res.error || "Failed to add charge");
    }
  };

  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRes) return;

    setIsProcessing(true);
    setErrorMsg(null);

    const amountNum = parseFloat(settlementAmount) || 0;
    const res = await checkOutGuestAction(
      hotelId,
      selectedRes.id,
      amountNum > 0 ? { amount: amountNum, method, ref, notes } : undefined,
      { adjustNightsForEarlyCheckout: adjustEarlyCheckout }
    );

    setIsProcessing(false);
    if (res.success) {
      setSelectedRes(null);
      router.push("/dashboard/room-board");
      router.refresh();
    } else {
      setErrorMsg(res.error || "Failed to checkout guest");
    }
  };

  // Early Checkout Calculations for Modal
  const now = new Date();
  const inDate = selectedRes ? new Date(selectedRes.checkInDate) : new Date();
  const schedOut = selectedRes ? new Date(selectedRes.checkOutDate) : new Date();
  const inNorm = new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
  const nowNorm = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const schedNorm = new Date(schedOut.getFullYear(), schedOut.getMonth(), schedOut.getDate());

  const isEarlyCheckout = selectedRes ? nowNorm.getTime() < schedNorm.getTime() : false;
  const actualStayNights = selectedRes ? Math.max(1, Math.round((nowNorm.getTime() - inNorm.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const unstayedNights = selectedRes ? Math.max(0, selectedRes.totalNights - actualStayNights) : 0;
  const approxRate = selectedRes ? (selectedRes.nightlyRateSnapshot || (selectedRes.totalNights > 0 ? selectedRes.totalAmount / selectedRes.totalNights : 0)) : 0;
  const deductionAmount = unstayedNights * approxRate;

  const effectiveTotal = selectedRes
    ? (isEarlyCheckout && adjustEarlyCheckout && unstayedNights > 0
        ? Math.max(0, selectedRes.totalAmount - deductionAmount)
        : selectedRes.totalAmount)
    : 0;

  const effectiveDue = selectedRes ? Math.max(0, effectiveTotal - selectedRes.paidAmount) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          Front Desk Guest Check-Out & Folio Settlement
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Review room charges, add incidentals or mini-bar, extend stays, settle balances, and support early departure night adjustments.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search departing guests by room, name, or phone..."
          className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
        />
      </div>

      {/* Currently Checked-In Rooms Grid */}
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
                  <span className="text-slate-500">Scheduled Departure:</span>
                  <span className="font-semibold text-slate-800">{formatDate(res.checkOutDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Stay Bill:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(res.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid so far:</span>
                  <span className="font-semibold text-emerald-700">{formatCurrency(res.paidAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-700 font-semibold">Remaining Due:</span>
                  <span className={`font-extrabold ${res.outstandingBalance > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {res.outstandingBalance > 0 ? formatCurrency(res.outstandingBalance) : "Settled (0.00)"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenCheckoutModal(res)}
                >
                  <UserMinus className="w-4 h-4 mr-1.5" />
                  Settle & Check-Out
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenExtendModal(res)}
                  title="Extend stay (same or different room)"
                >
                  <CalendarPlus className="w-4 h-4 mr-1 text-[#0F2744]" />
                  Extend
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-sm font-semibold text-slate-700">No checked-in guests found.</p>
        </div>
      )}

      {/* Check-Out Folio Settlement Modal */}
      {selectedRes && (
        <Modal
          isOpen={!!selectedRes}
          onClose={() => setSelectedRes(null)}
          title={`Check-Out: Room #${selectedRes.room.roomNumber}`}
          description={`Guest: ${selectedRes.guest.fullName} • ${selectedRes.reservationNumber}`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Early Check-Out Alert Banner */}
            {isEarlyCheckout && unstayedNights > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2 text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Early Departure Detected</span>
                    <span>
                      Guest scheduled <strong>{selectedRes.totalNights} nights</strong> (until {formatDate(selectedRes.checkOutDate)}), but is checking out early after <strong>{actualStayNights} night(s)</strong>.
                    </span>
                  </div>
                </div>
                <label className="flex items-center gap-2 font-semibold text-amber-950 cursor-pointer pt-1 border-t border-amber-200">
                  <input
                    type="checkbox"
                    checked={adjustEarlyCheckout}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setAdjustEarlyCheckout(isChecked);
                      if (isChecked) {
                        const newDue = Math.max(0, selectedRes.totalAmount - deductionAmount - selectedRes.paidAmount);
                        setSettlementAmount(newDue.toString());
                      } else {
                        setSettlementAmount(selectedRes.outstandingBalance.toString());
                      }
                    }}
                    className="w-4 h-4 rounded text-[#0F2744] focus:ring-amber-500 cursor-pointer"
                  />
                  <span>
                    Adjust bill to actual stayed nights ({actualStayNights} nights) — Deduct {unstayedNights} unstayed night ({formatCurrency(deductionAmount)})
                  </span>
                </label>
              </div>
            )}

            {/* Bill Summary */}
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed Charges:</span>
                <span className="font-bold text-slate-900">{formatCurrency(effectiveTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Collected Advance & Payments:</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(selectedRes.paidAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-700 font-bold">Outstanding Balance Due:</span>
                <span className={`font-extrabold text-base ${effectiveDue > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {effectiveDue > 0 ? formatCurrency(effectiveDue) : "Settled (0.00)"}
                </span>
              </div>
            </div>

            {/* Incidentals Toggle */}
            <div className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Add Incidental / Extra Charges</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCharge(!showAddCharge)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {showAddCharge ? "Hide" : "Add Extra Charge"}
                </Button>
              </div>

              {showAddCharge && (
                <form onSubmit={handleAddIncidental} className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Item Description"
                      required
                      placeholder="e.g. Mini-bar Snickers & Juice"
                      value={chargeDesc}
                      onChange={(e) => setChargeDesc(e.target.value)}
                    />
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 uppercase">Category</label>
                      <select
                        value={chargeType}
                        onChange={(e) => setChargeType(e.target.value as InvoiceItemType)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="FOOD_BEVERAGE">Food & Beverage</option>
                        <option value="LAUNDRY">Laundry</option>
                        <option value="SERVICE">Service</option>
                        <option value="DAMAGE">Damage</option>
                        <option value="EXTRA_GUEST">Extra Guest</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Quantity"
                      type="number"
                      min="1"
                      value={chargeQty}
                      onChange={(e) => setChargeQty(e.target.value)}
                    />
                    <Input
                      label="Unit Price (BDT)"
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 350"
                      value={chargePrice}
                      onChange={(e) => setChargePrice(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" size="sm" isLoading={isAddingCharge}>
                      Apply Charge to Folio
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Settle Balance Form */}
            <form onSubmit={handleConfirmCheckout} className="space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Final Settlement Payment
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <Input
                  label="Settlement Amount (BDT)"
                  type="number"
                  min="0"
                  max={effectiveDue}
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                />
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">Method</label>
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
                label="Transaction Note / Voucher (Optional)"
                placeholder="e.g. POS Auth 948392"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedRes(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isProcessing}>
                  Confirm Settlement & Complete Check-Out
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Extend Stay Modal */}
      {extendingRes && (
        <Modal
          isOpen={!!extendingRes}
          onClose={() => setExtendingRes(null)}
          title={`Extend Stay: Room #${extendingRes.room.roomNumber}`}
          description={`Guest: ${extendingRes.guest.fullName} • Current Checkout: ${formatDate(extendingRes.checkOutDate)}`}
          maxWidth="lg"
        >
          <form onSubmit={handleConfirmExtension} className="space-y-4">
            {extendError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{extendError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Stay:</span>
                <span className="font-bold text-slate-800">
                  {formatDate(extendingRes.checkInDate)} → {formatDate(extendingRes.checkOutDate)} ({extendingRes.totalNights} nights)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Master Invoice:</span>
                <span className="font-semibold text-slate-700">
                  #{extendingRes.invoices[0]?.invoiceNumber || "Master Folio"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                New Checkout Date:
              </label>
              <input
                type="date"
                required
                min={new Date(new Date(extendingRes.checkOutDate).getTime() + 86400000).toISOString().slice(0, 10)}
                value={extensionDate}
                onChange={(e) => setExtensionDate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Room Assignment for Extension:
              </label>
              <select
                value={extensionRoomId}
                onChange={(e) => setExtensionRoomId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value={extendingRes.room.id}>
                  Same Room: #{extendingRes.room.roomNumber} ({extendingRes.room.type})
                </option>
                {rooms
                  ?.filter((rm) => rm.id !== extendingRes.room.id)
                  .map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Move to Room: #{rm.roomNumber} — {rm.type} ({formatCurrency(rm.basePrice)}/nt)
                    </option>
                  ))}
              </select>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                <span>Single Master Invoice Integration</span>
              </div>
              <p className="text-[11px] text-sky-800">
                Any extra nights (even if moving to a different room) will be automatically added to the <strong>existing master invoice</strong> as an itemized room charge. No separate invoice is required!
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setExtendingRes(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isExtending}>
                Confirm Stay Extension
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
