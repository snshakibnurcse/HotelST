import prisma from "@/lib/prisma";
import { Prisma, ReservationStatus, RoomStatus } from "@prisma/client";
import { differenceInCalendarDays, startOfDay } from "date-fns";

export interface BookingValidationResult {
  isAvailable: boolean;
  totalNights: number;
  conflictingReservation?: {
    id: string;
    reservationNumber: string;
    checkInDate: Date;
    checkOutDate: Date;
    status: ReservationStatus;
  } | null;
  errorMessage?: string;
}

/**
 * Normalizes a date to midnight UTC/Local start of day for strict calendar date comparison
 */
export function normalizeDate(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Validates check-in and checkout dates
 */
export function validateBookingDates(checkIn: Date | string, checkOut: Date | string): {
  isValid: boolean;
  checkInDate: Date;
  checkOutDate: Date;
  totalNights: number;
  error?: string;
} {
  const inDate = normalizeDate(checkIn);
  const outDate = normalizeDate(checkOut);

  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
    return {
      isValid: false,
      checkInDate: inDate,
      checkOutDate: outDate,
      totalNights: 0,
      error: "Invalid date format provided",
    };
  }

  const nights = differenceInCalendarDays(outDate, inDate);
  if (nights <= 0) {
    return {
      isValid: false,
      checkInDate: inDate,
      checkOutDate: outDate,
      totalNights: 0,
      error: "Checkout date must be at least one day after check-in date",
    };
  }

  return {
    isValid: true,
    checkInDate: inDate,
    checkOutDate: outDate,
    totalNights: nights,
  };
}

/**
 * Concurrency-safe overlap check against active reservations.
 * Two intervals [startA, endA) and [startB, endB) overlap iff:
 * startA < endB AND endA > startB
 */
export async function checkRoomAvailability(
  roomId: string,
  checkInDate: Date,
  checkOutDate: Date,
  excludeReservationId?: string,
  tx?: Prisma.TransactionClient
): Promise<BookingValidationResult> {
  const client = tx || prisma;

  // 1. Check if room exists and is not archived or out of service
  const room = await client.room.findUnique({
    where: { id: roomId },
    include: { roomType: true },
  });

  if (!room) {
    return { isAvailable: false, totalNights: 0, errorMessage: "Room not found" };
  }

  if (room.isArchived) {
    return { isAvailable: false, totalNights: 0, errorMessage: "Room has been archived and is not in service" };
  }

  if (room.status === RoomStatus.OUT_OF_SERVICE) {
    return { isAvailable: false, totalNights: 0, errorMessage: "Room is currently out of service" };
  }

  const dateValidation = validateBookingDates(checkInDate, checkOutDate);
  if (!dateValidation.isValid) {
    return { isAvailable: false, totalNights: 0, errorMessage: dateValidation.error };
  }

  // 2. Query for any conflicting reservation
  const conflict = await client.reservation.findFirst({
    where: {
      roomId,
      status: {
        in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
      },
      checkInDate: { lt: dateValidation.checkOutDate },
      checkOutDate: { gt: dateValidation.checkInDate },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: {
      id: true,
      reservationNumber: true,
      checkInDate: true,
      checkOutDate: true,
      status: true,
    },
  });

  if (conflict) {
    return {
      isAvailable: false,
      totalNights: dateValidation.totalNights,
      conflictingReservation: conflict,
      errorMessage: `Room is already booked under reservation #${conflict.reservationNumber} from ${conflict.checkInDate.toISOString().slice(0, 10)} to ${conflict.checkOutDate.toISOString().slice(0, 10)}`,
    };
  }

  return {
    isAvailable: true,
    totalNights: dateValidation.totalNights,
  };
}

/**
 * Calculates financial amounts for a proposed reservation stay
 */
export function calculateStayAmounts({
  nightlyRate,
  totalNights,
  discountAmount = 0,
  taxRatePercent = 0,
  additionalCharges = 0,
}: {
  nightlyRate: number;
  totalNights: number;
  discountAmount?: number;
  taxRatePercent?: number;
  additionalCharges?: number;
}) {
  const roomCharges = nightlyRate * totalNights;
  const subtotalAfterDiscount = Math.max(0, roomCharges - discountAmount + additionalCharges);
  const taxAmount = Number(((subtotalAfterDiscount * taxRatePercent) / 100).toFixed(2));
  const totalAmount = Number((subtotalAfterDiscount + taxAmount).toFixed(2));

  return {
    roomCharges: Number(roomCharges.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    taxAmount,
    additionalCharges: Number(additionalCharges.toFixed(2)),
    totalAmount,
  };
}

/**
 * Generates human-friendly sequential-style unique reservation code
 */
export function generateReservationCode(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `RES-${datePart}-${randomPart}`;
}

/**
 * Generates unique invoice number
 */
export function generateInvoiceCode(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `INV-${datePart}-${randomPart}`;
}

/**
 * Generates unique payment reference
 */
export function generatePaymentCode(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `PAY-${datePart}-${randomPart}`;
}

/**
 * Generates unique financial transaction reference
 */
export function generateTransactionCode(type: "INC" | "EXP"): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${type}-${datePart}-${randomPart}`;
}

export type BoardRoomStatus =
  | "AVAILABLE"
  | "OCCUPIED"
  | "RESERVED"
  | "CHECKOUT_TODAY"
  | "ARRIVAL_TODAY"
  | "MAINTENANCE"
  | "OUT_OF_SERVICE";

/**
 * Determines a room's visual display status for a specific target date
 */
export function resolveBoardStatusForDate({
  roomStatus,
  isArchived,
  activeReservations,
  targetDate,
}: {
  roomStatus: RoomStatus;
  isArchived: boolean;
  activeReservations: Array<{
    id: string;
    reservationNumber: string;
    checkInDate: Date;
    checkOutDate: Date;
    status: ReservationStatus;
    guestName?: string;
  }>;
  targetDate: Date;
}): {
  status: BoardRoomStatus;
  reservation?: (typeof activeReservations)[0];
  badgeColor: string;
  label: string;
} {
  if (isArchived || roomStatus === RoomStatus.OUT_OF_SERVICE) {
    return {
      status: "OUT_OF_SERVICE",
      badgeColor: "bg-slate-400 text-white",
      label: "Out of Service",
    };
  }

  if (roomStatus === RoomStatus.MAINTENANCE) {
    return {
      status: "MAINTENANCE",
      badgeColor: "bg-amber-600 text-white",
      label: "Maintenance",
    };
  }

  const normalizedTarget = startOfDay(targetDate).getTime();

  // Check if any reservation checks out on this day
  const checkoutReservation = activeReservations.find(
    (res) => startOfDay(new Date(res.checkOutDate)).getTime() === normalizedTarget
  );

  // Check if any reservation checks in on this day
  const arrivalReservation = activeReservations.find(
    (res) => startOfDay(new Date(res.checkInDate)).getTime() === normalizedTarget
  );

  // Check active stay covering target day: checkIn <= targetDate < checkOut
  const occupyingReservation = activeReservations.find((res) => {
    const inTime = startOfDay(new Date(res.checkInDate)).getTime();
    const outTime = startOfDay(new Date(res.checkOutDate)).getTime();
    return inTime <= normalizedTarget && normalizedTarget < outTime;
  });

  if (occupyingReservation) {
    if (occupyingReservation.status === ReservationStatus.CHECKED_IN) {
      if (checkoutReservation && checkoutReservation.id === occupyingReservation.id) {
        return {
          status: "CHECKOUT_TODAY",
          reservation: occupyingReservation,
          badgeColor: "bg-amber-500 text-white",
          label: "Checking Out Today",
        };
      }
      return {
        status: "OCCUPIED",
        reservation: occupyingReservation,
        badgeColor: "bg-rose-600 text-white",
        label: "Occupied",
      };
    }

    if (arrivalReservation && arrivalReservation.id === occupyingReservation.id) {
      return {
        status: "ARRIVAL_TODAY",
        reservation: occupyingReservation,
        badgeColor: "bg-purple-600 text-white",
        label: "Arriving Today",
      };
    }

    return {
      status: "RESERVED",
      reservation: occupyingReservation,
      badgeColor: "bg-sky-600 text-white",
      label: "Reserved",
    };
  }

  if (checkoutReservation) {
    return {
      status: "CHECKOUT_TODAY",
      reservation: checkoutReservation,
      badgeColor: "bg-amber-500 text-white",
      label: "Checkout Due",
    };
  }

  if (arrivalReservation) {
    return {
      status: "ARRIVAL_TODAY",
      reservation: arrivalReservation,
      badgeColor: "bg-purple-600 text-white",
      label: "Arrival Due",
    };
  }

  return {
    status: "AVAILABLE",
    badgeColor: "bg-emerald-600 text-white",
    label: "Available",
  };
}
