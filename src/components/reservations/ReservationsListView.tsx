"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  createReservationAction,
  cancelReservationAction,
  checkInGuestAction,
  checkOutGuestAction,
} from "@/actions/reservations";
import { Plus, Search, Calendar, User, CreditCard, ShieldAlert, CheckCircle, ArrowRight } from "lucide-react";
import { PaymentMethod, ReservationStatus } from "@prisma/client";
import Link from "next/navigation";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface ReservationItem {
  id: string;
  reservationNumber: string;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  status: ReservationStatus;
  adultCount: number;
  childCount: number;
  totalNights: number;
  nightlyRateSnapshot: number | { toString(): string };
  totalAmount: number | { toString(): string };
  paidAmount: number | { toString(): string };
  outstandingBalance: number | { toString(): string };
  guest: { id: string; fullName: string; mobile: string; email?: string | null };
  room: { roomNumber: string; roomType: { name: string } };
  invoices: Array<{ id: string; invoiceNumber: string; status: string }>;
}

interface RoomOption {
  id: string;
  roomNumber: string;
  roomType: { name: string; basePrice: number | { toString(): string } };
}

interface ReservationsListViewProps {
  hotelId: string;
  reservations: ReservationItem[];
  rooms: RoomOption[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  initialRoomId?: string;
  isReadOnly?: boolean;
}

export function ReservationsListView({
  hotelId,
  reservations,
  rooms,
  pagination,
  initialRoomId,
  isReadOnly = false,
}: ReservationsListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = React.useState(searchParams.get("status") || "ALL");

  // Create Reservation Modal
  const [isCreateOpen, setIsCreateOpen] = React.useState(!!initialRoomId);
  const [roomId, setRoomId] = React.useState(initialRoomId || rooms[0]?.id || "");
  const [guestFullName, setGuestFullName] = React.useState("");
  const [guestMobile, setGuestMobile] = React.useState("");
  const [guestEmail, setGuestEmail] = React.useState("");
  const [guestNid, setGuestNid] = React.useState("");
  const [guestAddress, setGuestAddress] = React.useState("");
  const [checkInDate, setCheckInDate] = React.useState(new Date().toISOString().slice(0, 10));
  const nextDay = new Date();
  nextDay.setDate(nextDay.getDate() + 1);
  const [checkOutDate, setCheckOutDate] = React.useState(nextDay.toISOString().slice(0, 10));
  const [adultCount, setAdultCount] = React.useState("1");
  const [childCount, setChildCount] = React.useState("0");
  const [bookingSource, setBookingSource] = React.useState("WALK_IN");
  const [discountAmount, setDiscountAmount] = React.useState("0");
  const [advancePaid, setAdvancePaid] = React.useState("0");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentRef, setPaymentRef] = React.useState("");
  const [specialRequests, setSpecialRequests] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [bookingError, setBookingError] = React.useState<string | null>(null);

  // Cancellation Modal
  const [cancellingResId, setCancellingResId] = React.useState<string | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [isCancelling, setIsCancelling] = React.useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    else params.delete("status");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setBookingError(null);

    const res = await createReservationAction(hotelId, {
      roomId,
      guestFullName,
      guestMobile,
      guestEmail: guestEmail || undefined,
      guestNid: guestNid || undefined,
      guestAddress: guestAddress || undefined,
      checkInDate,
      checkOutDate,
      adultCount: parseInt(adultCount) || 1,
      childCount: parseInt(childCount) || 0,
      bookingSource,
      discountAmount: parseFloat(discountAmount) || 0,
      additionalCharges: 0,
      advancePaid: parseFloat(advancePaid) || 0,
      paymentMethod,
      paymentRef: paymentRef || undefined,
      specialRequests: specialRequests || undefined,
    });

    setIsSubmitting(false);
    if (res.success) {
      setIsCreateOpen(false);
      router.refresh();
    } else {
      setBookingError(res.error || "Failed to create reservation");
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingResId) return;

    setIsCancelling(true);
    const res = await cancelReservationAction(hotelId, cancellingResId, cancelReason);
    setIsCancelling(false);

    if (res.success) {
      setCancellingResId(null);
      setCancelReason("");
      router.refresh();
    } else {
      alert(res.error || "Failed to cancel reservation");
    }
  };

  const handleQuickCheckIn = async (resId: string) => {
    if (!confirm("Confirm guest check-in arrival for this reservation?")) return;
    const res = await checkInGuestAction(hotelId, resId);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Check-in failed");
    }
  };

  const handleQuickCheckOut = async (resId: string) => {
    if (!confirm("Confirm guest departure and check-out for this reservation?")) return;
    const res = await checkOutGuestAction(hotelId, resId);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Check-out failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Reservation & Booking Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Advance bookings, walk-ins, check-in verification, and guest billing.
          </p>
        </div>

        {!isReadOnly && (
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Reservation / Walk-In
          </Button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reservation #, guest name, phone, or room..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
        >
          <option value="ALL">All Statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CHECKED_IN">Checked In</option>
          <option value="CHECKED_OUT">Checked Out</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <Button type="submit" variant="secondary" size="sm">
          Filter
        </Button>
      </form>

      {/* Reservations List: Mobile Cards + Desktop Table */}
      <Card>
        <CardContent className="p-0">
          {/* Mobile Card List (md:hidden) */}
          <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
            {reservations.length > 0 ? (
              reservations.map((res) => (
                <div key={res.id} className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-slate-900 block">{res.reservationNumber}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Room {res.room.roomNumber} ({res.room.roomType.name})</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        res.status === "CHECKED_IN"
                          ? "bg-emerald-100 text-emerald-800"
                          : res.status === "CONFIRMED"
                          ? "bg-sky-100 text-sky-800"
                          : res.status === "CHECKED_OUT"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {res.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="font-semibold block">{res.guest.fullName}</span>
                      <span className="text-[10px] text-slate-400 block">{res.guest.mobile}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block text-[10px]">
                        {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)}
                      </span>
                      <span className="font-bold text-slate-900 block text-[11px]">{res.totalNights} Night(s)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-500">Total: </span>
                      <span className="font-bold text-slate-900">{formatCurrency(res.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Balance: </span>
                      {Number(res.outstandingBalance) > 0 ? (
                        <span className="font-bold text-rose-600">{formatCurrency(res.outstandingBalance)}</span>
                      ) : (
                        <span className="font-bold text-emerald-600">Settled</span>
                      )}
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/80">
                      {res.status === "CONFIRMED" && (
                        <button
                          onClick={() => handleQuickCheckIn(res.id)}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-xs text-center cursor-pointer"
                        >
                          Check In Guest
                        </button>
                      )}
                      {res.status === "CHECKED_IN" && (
                        <button
                          onClick={() => handleQuickCheckOut(res.id)}
                          className="flex-1 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 font-semibold text-xs text-center cursor-pointer"
                        >
                          Check Out Guest
                        </button>
                      )}
                      {res.status !== "CANCELLED" && res.status !== "CHECKED_OUT" && (
                        <button
                          onClick={() => setCancellingResId(res.id)}
                          className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-semibold text-xs cursor-pointer border border-slate-200"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">No reservations found.</div>
            )}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Res #</th>
                  <th className="py-3 px-4 font-semibold">Guest</th>
                  <th className="py-3 px-4 font-semibold">Room</th>
                  <th className="py-3 px-4 font-semibold">Stay Dates</th>
                  <th className="py-3 px-4 font-semibold">Bill Total</th>
                  <th className="py-3 px-4 font-semibold">Balance Due</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  {!isReadOnly && <th className="py-3 px-4 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{res.reservationNumber}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">{res.guest.fullName}</span>
                      <span className="text-[10px] text-slate-400 block">{res.guest.mobile}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 block">Room {res.room.roomNumber}</span>
                      <span className="text-[10px] text-slate-400 block">{res.room.roomType.name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <span className="block font-medium">
                        {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{res.totalNights} Night(s)</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {formatCurrency(res.totalAmount)}
                    </td>
                    <td className="py-3 px-4">
                      {Number(res.outstandingBalance) > 0 ? (
                        <span className="font-bold text-rose-600">
                          {formatCurrency(res.outstandingBalance)}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600">Paid in Full</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          res.status === "CHECKED_IN"
                            ? "bg-emerald-100 text-emerald-800"
                            : res.status === "CONFIRMED"
                            ? "bg-sky-100 text-sky-800"
                            : res.status === "CHECKED_OUT"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {res.status.replace("_", " ")}
                      </span>
                    </td>
                    {!isReadOnly && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {res.status === "CONFIRMED" && (
                            <button
                              onClick={() => handleQuickCheckIn(res.id)}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[10px] cursor-pointer"
                            >
                              Check In
                            </button>
                          )}
                          {res.status === "CHECKED_IN" && (
                            <button
                              onClick={() => handleQuickCheckOut(res.id)}
                              className="px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold text-[10px] cursor-pointer"
                            >
                              Check Out
                            </button>
                          )}
                          {res.status !== "CANCELLED" && res.status !== "CHECKED_OUT" && (
                            <button
                              onClick={() => setCancellingResId(res.id)}
                              className="px-2 py-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-semibold text-[10px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New Reservation Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Guest Reservation"
        description="Verify room availability and calculate stay charges automatically."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateReservation} className="space-y-4">
          {bookingError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{bookingError}</span>
            </div>
          )}

          {/* Room Selection */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase">Assigned Room</label>
            <select
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
            >
              {rooms.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  Room {rm.roomNumber} ({rm.roomType.name} • {formatCurrency(rm.roomType.basePrice)}/night)
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <Input
              label="Check-In Date"
              type="date"
              required
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
            />
            <Input
              label="Check-Out Date"
              type="date"
              required
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
            />
          </div>

          {/* Guest Details */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
              Guest Information
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <Input
                label="Full Name"
                required
                placeholder="e.g. Asif Ahmed"
                value={guestFullName}
                onChange={(e) => setGuestFullName(e.target.value)}
              />
              <Input
                label="Mobile Number"
                required
                placeholder="e.g. +8801700000000"
                value={guestMobile}
                onChange={(e) => setGuestMobile(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mt-2">
              <Input
                label="Email (Optional)"
                type="email"
                placeholder="guest@example.com"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
              <Input
                label="NID / Passport (Optional)"
                placeholder="National ID / Passport"
                value={guestNid}
                onChange={(e) => setGuestNid(e.target.value)}
              />
            </div>
          </div>

          {/* Pricing Adjustments & Advance Payment */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
              Billing & Advance Payment
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <Input
                label="Discount Amount (BDT)"
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
              <Input
                label="Advance Paid (BDT)"
                type="number"
                min="0"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
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
            <div className="mt-2">
              <Input
                label="Transaction Ref / Note (Optional)"
                placeholder="e.g. TrxID / Receipt note"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Confirm & Book Stay
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancellation Modal */}
      {cancellingResId && (
        <Modal
          isOpen={!!cancellingResId}
          onClose={() => setCancellingResId(null)}
          title="Cancel Reservation"
          description="Provide a reason for the cancellation. This action is permanently audited."
        >
          <form onSubmit={handleCancel} className="space-y-4">
            <Input
              label="Cancellation Reason"
              required
              placeholder="e.g. Guest requested flight change"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setCancellingResId(null)}>
                Close
              </Button>
              <Button type="submit" variant="danger" size="sm" isLoading={isCancelling}>
                Confirm Cancellation
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
