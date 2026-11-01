"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { checkAvailabilityAction } from "@/actions/reservations";
import {
  Calendar,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Wrench,
  User,
  ArrowRight,
  Layers,
  CalendarRange,
  AlertTriangle,
  CalendarClock,
  Phone,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export interface UpcomingBookingInfo {
  id: string;
  reservationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  guestName?: string;
  guestMobile?: string;
  nights: number;
}

export interface DayScheduleItem {
  dateStr: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isBooked: boolean;
  isCheckinDay: boolean;
  isCheckoutDay: boolean;
  guestName?: string;
  reservationNumber?: string;
  status?: string;
}

interface BoardTile {
  id: string;
  roomNumber: string;
  floor: string;
  roomType: string;
  basePrice: number;
  isClean: boolean;
  boardStatus: string;
  badgeColor: string;
  statusLabel: string;
  reservation?: {
    id: string;
    reservationNumber: string;
    checkInDate: Date | string;
    checkOutDate: Date | string;
    status: string;
    guestName?: string;
  };
  futureBookings?: UpcomingBookingInfo[];
  nextBookingDate?: string | null;
  availableDaysUntilNext?: number | null;
  schedule14Days?: DayScheduleItem[];
}

interface RoomBoardViewProps {
  hotelId: string;
  boardData: {
    targetDate: string;
    totalRooms: number;
    availableRooms: number;
    occupiedRooms: number;
    reservedRooms: number;
    checkoutTodayRooms: number;
    arrivalTodayRooms: number;
    maintenanceRooms: number;
    tiles: BoardTile[];
  };
  roomTypes: Array<{ id: string; name: string }>;
  isReadOnly?: boolean;
}

export function RoomBoardView({ hotelId, boardData, roomTypes, isReadOnly = false }: RoomBoardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedDate, setSelectedDate] = React.useState(
    boardData.targetDate.slice(0, 10)
  );
  const [selectedFloor, setSelectedFloor] = React.useState("ALL");
  const [selectedType, setSelectedType] = React.useState("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState("ALL");

  // Room details modal
  const [activeTile, setActiveTile] = React.useState<BoardTile | null>(null);

  // Date range checker modal
  const [isCheckerOpen, setIsCheckerOpen] = React.useState(false);
  const [checkRoomId, setCheckRoomId] = React.useState("");
  const [checkIn, setCheckIn] = React.useState("");
  const [checkOut, setCheckOut] = React.useState("");
  const [checkingAvailability, setCheckingAvailability] = React.useState(false);
  const [checkResult, setCheckResult] = React.useState<{ isAvailable: boolean; message: string } | null>(null);

  const handleDateChange = (newDateStr: string) => {
    setSelectedDate(newDateStr);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", newDateStr);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = d.toISOString().slice(0, 10);
    handleDateChange(dateStr);
  };

  const floors = Array.from(new Set(boardData.tiles.map((t) => t.floor))).sort();

  const filteredTiles = boardData.tiles.filter((tile) => {
    if (selectedFloor !== "ALL" && tile.floor !== selectedFloor) return false;
    if (selectedType !== "ALL" && tile.roomType !== selectedType) return false;
    if (selectedStatus !== "ALL" && tile.boardStatus !== selectedStatus) return false;
    return true;
  });

  const runAvailabilityCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkRoomId || !checkIn || !checkOut) return;

    setCheckingAvailability(true);
    setCheckResult(null);

    const res = await checkAvailabilityAction(hotelId, checkRoomId, checkIn, checkOut);
    setCheckingAvailability(false);

    if (res.isAvailable) {
      setCheckResult({
        isAvailable: true,
        message: `✓ Room is fully available for ${res.totalNights} nights (${checkIn} to ${checkOut}).`,
      });
    } else {
      setCheckResult({
        isAvailable: false,
        message: `✕ Unavailable: ${res.errorMessage || "Dates overlap with an active booking."}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Date Navigation */}
      {/* Top Header & Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Visual Room Availability Board
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Real-time occupancy status calculated for:{" "}
            <span className="font-semibold text-slate-800">{formatDate(boardData.targetDate)}</span>
          </p>
        </div>

        {/* Date Selector & Range Checker Trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleQuickDate(0)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-[11px] sm:text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={() => handleQuickDate(1)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-[11px] sm:text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
            >
              Tmrw
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="text-[11px] sm:text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCheckerOpen(true)}
            className="text-[11px] sm:text-xs py-1 h-auto"
          >
            <Calendar className="w-3.5 h-3.5 mr-1 text-[#0F2744]" />
            Check Range
          </Button>
        </div>
      </div>

      {/* Color Legend Bar */}
      <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-2 sm:gap-3.5 text-[10px] sm:text-xs font-semibold">
        <span className="text-slate-400 font-medium hidden sm:inline">Status Legend:</span>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          <span className="text-slate-700">Available ({boardData.availableRooms})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
          <span className="text-slate-700">Occupied ({boardData.occupiedRooms})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
          <span className="text-slate-700">Reserved ({boardData.reservedRooms})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-700">Checkout ({boardData.checkoutTodayRooms})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
          <span className="text-slate-700">Arriving ({boardData.arrivalTodayRooms})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          <span className="text-slate-700">Maint ({boardData.maintenanceRooms})</span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3 text-xs">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase sm:hidden mb-0.5">Floor</label>
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Floors</option>
            {floors.map((fl) => (
              <option key={fl} value={fl}>
                Floor {fl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase sm:hidden mb-0.5">Category</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Types</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.name}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase sm:hidden mb-0.5">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="AVAILABLE">Available</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="RESERVED">Reserved</option>
            <option value="CHECKOUT_TODAY">Checkout</option>
            <option value="ARRIVAL_TODAY">Arrival</option>
            <option value="MAINTENANCE">Maint</option>
          </select>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
        {filteredTiles.map((tile) => (
          <button
            key={tile.id}
            onClick={() => setActiveTile(tile)}
            className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-2.5 sm:p-3 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between min-h-[120px] sm:h-32 cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-[#0F2744] transition-colors leading-tight block">
                  #{tile.roomNumber}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 block font-medium">Floor {tile.floor}</span>
              </div>
              <span
                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0 mt-0.5 ${
                  tile.boardStatus === "AVAILABLE"
                    ? "bg-emerald-500"
                    : tile.boardStatus === "OCCUPIED"
                    ? "bg-rose-500"
                    : tile.boardStatus === "RESERVED"
                    ? "bg-sky-500"
                    : tile.boardStatus === "CHECKOUT_TODAY"
                    ? "bg-amber-500"
                    : tile.boardStatus === "ARRIVAL_TODAY"
                    ? "bg-purple-500"
                    : "bg-slate-400"
                }`}
              />
            </div>

            <div>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 truncate block">
                {tile.roomType}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 block">{formatCurrency(tile.basePrice)}/nt</span>
            </div>

            <div className="pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
              <span
                className={`text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.5 rounded ${tile.badgeColor}`}
              >
                {tile.statusLabel}
              </span>
              {tile.boardStatus === "AVAILABLE" && (
                tile.availableDaysUntilNext !== null && tile.availableDaysUntilNext !== undefined ? (
                  <span
                    className="text-[8px] sm:text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200"
                    title={`Free for next ${tile.availableDaysUntilNext} night(s) before next check-in on ${formatDate(tile.nextBookingDate)}`}
                  >
                    Free {tile.availableDaysUntilNext}d
                  </span>
                ) : (
                  <span className="text-[8px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                    Free 90d+
                  </span>
                )
              )}
              {!tile.isClean && (
                <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                  Dirty
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {filteredTiles.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-sm font-semibold text-slate-700">No rooms match the selected filters.</p>
        </div>
      )}

      {/* Tile Details Modal */}
      {activeTile && (
        <Modal
          isOpen={!!activeTile}
          onClose={() => setActiveTile(null)}
          title={`Room #${activeTile.roomNumber} Availability & Future Bookings`}
          description={`${activeTile.roomType} • Floor ${activeTile.floor}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Top Room Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
              <div>
                <span className="text-slate-400 block">Nightly Rate:</span>
                <span className="font-bold text-slate-800">{formatCurrency(activeTile.basePrice)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Housekeeping:</span>
                <span className={`font-bold ${activeTile.isClean ? "text-emerald-700" : "text-amber-700"}`}>
                  {activeTile.isClean ? "Clean & Sanitized" : "Requires Housekeeping"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Status on {formatDate(selectedDate)}:</span>
                <span className="font-bold text-slate-800">{activeTile.statusLabel}</span>
              </div>
            </div>

            {/* Current Target Date Booking (if any) */}
            {activeTile.reservation ? (
              <div className="p-3 border border-slate-200 rounded-lg bg-white space-y-2 text-xs">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  Current Reservation on Selected Date
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Reservation:</span>
                    <span className="font-bold text-slate-800">#{activeTile.reservation.reservationNumber}</span>
                  </div>
                  {activeTile.reservation.guestName && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">Guest Name:</span>
                      <span className="font-bold text-slate-800">{activeTile.reservation.guestName}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block text-[11px]">Duration:</span>
                    <span className="font-semibold text-slate-800">
                      {formatDate(activeTile.reservation.checkInDate)} → {formatDate(activeTile.reservation.checkOutDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Status:</span>
                    <span className="font-semibold text-slate-800 uppercase">{activeTile.reservation.status}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Future Availability & Upcoming Bookings Section */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                  <CalendarRange className="w-4 h-4 text-[#0F2744]" />
                  <span>Future Booking Schedule (ভবিষ্যতের বুকিং তথ্য)</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  From {formatDate(selectedDate)} onwards
                </span>
              </div>

              {/* Next Booking Alert Banner */}
              {activeTile.boardStatus === "AVAILABLE" ? (
                activeTile.availableDaysUntilNext !== null && activeTile.availableDaysUntilNext !== undefined ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold block">
                        Free for next {activeTile.availableDaysUntilNext} night{activeTile.availableDaysUntilNext > 1 ? "s" : ""} only
                      </span>
                      <span>
                        This room has an upcoming booking starting on{" "}
                        <strong className="text-amber-950 font-bold underline">
                          {formatDate(activeTile.nextBookingDate)}
                        </strong>
                        . You can safely book this room for up to{" "}
                        <strong className="font-bold">
                          {activeTile.availableDaysUntilNext} night{activeTile.availableDaysUntilNext > 1 ? "s" : ""}
                        </strong>{" "}
                        (checkout by {formatDate(activeTile.nextBookingDate)}) without date conflicts.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-900">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold block">100% Free for Extended Stay</span>
                      <span>
                        No upcoming bookings found for this room in the next 90 days. Completely available for any future date range!
                      </span>
                    </div>
                  </div>
                )
              ) : activeTile.boardStatus === "OCCUPIED" ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-900">
                  <Clock className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold block">Currently Occupied</span>
                    <span>
                      Occupying guest departs on{" "}
                      <strong>{formatDate(activeTile.reservation?.checkOutDate)}</strong>.
                      {activeTile.nextBookingDate && (
                        <> Next upcoming reservation begins on <strong>{formatDate(activeTile.nextBookingDate)}</strong>.</>
                      )}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* 14-Day Visual Mini Calendar Strip */}
              {activeTile.schedule14Days && activeTile.schedule14Days.length > 0 && (
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      14-Day Visual Availability (পরবর্তী ১৪ দিনের দিনভিত্তিক স্ট্যাটাস):
                    </span>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Free
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Booked
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 sm:grid-cols-7 md:grid-cols-14 gap-1 pt-1">
                    {activeTile.schedule14Days.map((day) => (
                      <div
                        key={day.dateStr}
                        title={
                          day.isBooked
                            ? `Reserved: #${day.reservationNumber || ""} (${day.guestName || "Guest"})`
                            : `${day.dateStr} — Free & Available`
                        }
                        className={`p-1 rounded border text-center transition-all ${
                          day.isBooked
                            ? "bg-rose-50 border-rose-300 text-rose-900 shadow-2xs"
                            : "bg-white border-emerald-300 text-emerald-900"
                        }`}
                      >
                        <span className="block text-[8px] uppercase font-bold text-slate-400">
                          {day.dayName}
                        </span>
                        <span className="block text-[11px] font-extrabold my-0.5">
                          {day.dayNumber}
                        </span>
                        <span className="block text-[8px] font-medium text-slate-400">
                          {day.monthName}
                        </span>
                        <span
                          className={`block text-[7px] font-bold px-0.5 py-0.2 mt-0.5 rounded ${
                            day.isBooked ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                          }`}
                        >
                          {day.isBooked ? "Booked" : "Free"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* List of Specific Future Bookings */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  Upcoming Booked Dates ({activeTile.futureBookings?.length || 0} reservation{(activeTile.futureBookings?.length || 0) === 1 ? "" : "s"}):
                </span>

                {activeTile.futureBookings && activeTile.futureBookings.length > 0 ? (
                  <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                    {activeTile.futureBookings.map((b) => (
                      <div
                        key={b.id}
                        className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs hover:border-slate-300 transition"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900">
                              {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                              {b.nights} night{b.nights > 1 ? "s" : ""}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {b.status}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-2 flex-wrap">
                            <span>Res: <strong className="text-slate-700">#{b.reservationNumber}</strong></span>
                            {b.guestName && (
                              <span>• Guest: <strong className="text-slate-700">{b.guestName}</strong></span>
                            )}
                            {b.guestMobile && (
                              <span className="text-slate-400 flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5" /> {b.guestMobile}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTile(null);
                            router.push(`/dashboard/reservations?search=${encodeURIComponent(b.reservationNumber)}`);
                          }}
                          className="text-xs font-semibold text-[#0F2744] hover:underline cursor-pointer shrink-0 ml-2"
                        >
                          View Res →
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-500 bg-slate-50">
                    No future bookings found for this room.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Actions */}
            {!isReadOnly && (
              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <Button variant="secondary" size="sm" onClick={() => setActiveTile(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const roomNum = activeTile.roomNumber;
                    setActiveTile(null);
                    router.push(`/dashboard/reservations?createForRoom=${activeTile.id}`);
                  }}
                >
                  <CalendarClock className="w-3.5 h-3.5 mr-1" />
                  Book Room #{activeTile.roomNumber}
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Date Range Availability Checker Modal */}
      <Modal
        isOpen={isCheckerOpen}
        onClose={() => {
          setIsCheckerOpen(false);
          setCheckResult(null);
        }}
        title="Check Room Date-Range Availability"
        description="Verify whether a specific room is vacant across a proposed continuous multi-night stay."
      >
        <form onSubmit={runAvailabilityCheck} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Select Room</label>
            <select
              required
              value={checkRoomId}
              onChange={(e) => setCheckRoomId(e.target.value)}
              className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="">-- Choose Room --</option>
              {boardData.tiles.map((t) => (
                <option key={t.id} value={t.id}>
                  Room {t.roomNumber} ({t.roomType} • Floor {t.floor})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Proposed Check-In</label>
              <input
                type="date"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Proposed Check-Out</label>
              <input
                type="date"
                required
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          {checkResult && (
            <div
              className={`p-3 rounded-lg text-xs font-medium ${
                checkResult.isAvailable
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {checkResult.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsCheckerOpen(false);
                setCheckResult(null);
              }}
            >
              Close
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={checkingAvailability}>
              Check Vacancy
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
