"use server";

import prisma from "@/lib/prisma";
import { requireHotelReadAccess, requireManager } from "@/lib/auth/tenant";
import { resolveBoardStatusForDate } from "@/lib/booking";
import { logAuditEvent } from "@/lib/audit";
import { RoomStatus } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const roomTypeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(2, "Code is required").max(10),
  description: z.string().optional(),
  basePrice: z.number().positive("Base price must be positive"),
  maxAdults: z.number().int().min(1).default(2),
  maxChildren: z.number().int().min(0).default(1),
  totalBeds: z.number().int().min(1).default(1),
  bedConfiguration: z.string().default("1 King Bed"),
  amenities: z.array(z.string()).default([]),
});

const roomSchema = z.object({
  roomNumber: z.string().min(1, "Room number is required"),
  floor: z.string().default("1"),
  roomTypeId: z.string().min(1, "Room type is required"),
  status: z.nativeEnum(RoomStatus).default(RoomStatus.AVAILABLE),
  description: z.string().optional(),
});

export async function getRoomTypesAction(hotelId: string) {
  await requireHotelReadAccess(hotelId);
  const types = await prisma.roomType.findMany({
    where: { hotelId },
    orderBy: { name: "asc" },
  });
  return types.map((t) => ({
    ...t,
    basePrice: Number(t.basePrice),
  }));
}

export async function createRoomTypeAction(hotelId: string, rawData: z.infer<typeof roomTypeSchema>) {
  const manager = await requireManager(hotelId);
  const parsed = roomTypeSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { name, code, description, basePrice, maxAdults, maxChildren, totalBeds, bedConfiguration, amenities } = parsed.data;

  try {
    const existing = await prisma.roomType.findUnique({
      where: { hotelId_code: { hotelId, code: code.toUpperCase() } },
    });
    if (existing) {
      return { success: false, error: `Room category code '${code}' already exists in this hotel.` };
    }

    const roomType = await prisma.roomType.create({
      data: {
        hotelId,
        name,
        code: code.toUpperCase(),
        description: description || null,
        basePrice,
        maxAdults,
        maxChildren,
        totalBeds,
        bedConfiguration,
        amenities: JSON.stringify(amenities),
      },
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "ROOM_TYPE_CREATED",
      entityType: "ROOM_TYPE",
      entityId: roomType.id,
      metadata: { name: roomType.name, code: roomType.code, basePrice },
    });

    return { success: true, roomType };
  } catch (err) {
    console.error("Failed to create room type:", err);
    return { success: false, error: "Database error while creating room category." };
  }
}

export async function getRoomsAction(
  hotelId: string,
  filters?: {
    floor?: string;
    roomTypeId?: string;
    status?: RoomStatus;
    search?: string;
    includeArchived?: boolean;
  }
) {
  await requireHotelReadAccess(hotelId);

  const whereClause: Record<string, unknown> = {
    hotelId,
    isArchived: filters?.includeArchived ?? false,
  };

  if (filters?.floor && filters.floor !== "ALL") {
    whereClause.floor = filters.floor;
  }
  if (filters?.roomTypeId && filters.roomTypeId !== "ALL") {
    whereClause.roomTypeId = filters.roomTypeId;
  }
  if (filters?.status) {
    whereClause.status = filters.status;
  }
  if (filters?.search) {
    whereClause.roomNumber = { contains: filters.search };
  }

  return prisma.room.findMany({
    where: whereClause,
    include: {
      roomType: true,
      reservations: {
        where: {
          status: { in: ["CONFIRMED", "CHECKED_IN"] },
        },
        include: {
          guest: { select: { fullName: true, mobile: true } },
        },
        orderBy: { checkInDate: "asc" },
        take: 3,
      },
    },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });
}

export async function createRoomAction(hotelId: string, rawData: z.infer<typeof roomSchema>) {
  const manager = await requireManager(hotelId);
  const parsed = roomSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { roomNumber, floor, roomTypeId, status, description } = parsed.data;

  try {
    const existing = await prisma.room.findUnique({
      where: { hotelId_roomNumber: { hotelId, roomNumber } },
    });
    if (existing) {
      if (existing.isArchived) {
        // Reactivate archived room
        const reactivated = await prisma.room.update({
          where: { id: existing.id },
          data: { isArchived: false, floor, roomTypeId, status, description },
        });
        return { success: true, room: reactivated };
      }
      return { success: false, error: `Room number ${roomNumber} already exists in this hotel.` };
    }

    const room = await prisma.room.create({
      data: {
        hotelId,
        roomNumber,
        floor,
        roomTypeId,
        status,
        description: description || null,
      },
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "ROOM_CREATED",
      entityType: "ROOM",
      entityId: room.id,
      metadata: { roomNumber: room.roomNumber, floor: room.floor },
    });

    revalidatePath(`/dashboard/rooms`);
    return { success: true, room };
  } catch (err) {
    console.error("Failed to create room:", err);
    return { success: false, error: "Database error while adding room." };
  }
}

export async function updateRoomAction(
  hotelId: string,
  roomId: string,
  data: Partial<z.infer<typeof roomSchema>> & { isClean?: boolean }
) {
  const manager = await requireManager(hotelId);

  try {
    const room = await prisma.room.findFirst({
      where: { id: roomId, hotelId },
    });
    if (!room) {
      return { success: false, error: "Room not found in this hotel" };
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(data.floor ? { floor: data.floor } : {}),
        ...(data.roomTypeId ? { roomTypeId: data.roomTypeId } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isClean !== undefined ? { isClean: data.isClean } : {}),
      },
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "ROOM_UPDATED",
      entityType: "ROOM",
      entityId: roomId,
      metadata: { changes: Object.keys(data) },
    });

    revalidatePath(`/dashboard/rooms`);
    return { success: true, room: updated };
  } catch (err) {
    console.error("Failed to update room:", err);
    return { success: false, error: "Database error while updating room." };
  }
}

export async function archiveRoomAction(hotelId: string, roomId: string) {
  const manager = await requireManager(hotelId);

  try {
    // Check if room has active stays
    const activeStay = await prisma.reservation.findFirst({
      where: {
        roomId,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    });
    if (activeStay) {
      return {
        success: false,
        error: `Cannot archive room: it has active or upcoming reservation #${activeStay.reservationNumber}. Cancel or reassign the stay first.`,
      };
    }

    const archived = await prisma.room.update({
      where: { id: roomId },
      data: { isArchived: true, status: RoomStatus.OUT_OF_SERVICE },
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "ROOM_ARCHIVED",
      entityType: "ROOM",
      entityId: roomId,
    });

    revalidatePath(`/dashboard/rooms`);
    return { success: true, room: archived };
  } catch (err) {
    console.error("Failed to archive room:", err);
    return { success: false, error: "Failed to archive room." };
  }
}

export async function getRoomDetailsAction(hotelId: string, roomId: string) {
  await requireHotelReadAccess(hotelId);

  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
    include: {
      roomType: true,
      reservations: {
        include: {
          guest: {
            select: { id: true, fullName: true, mobile: true, email: true },
          },
          invoices: {
            select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, status: true },
          },
        },
        orderBy: { checkInDate: "desc" },
        take: 20,
      },
    },
  });

  if (!room) {
    throw new Error("Room not found");
  }

  return room;
}

/**
 * Visual Room Board Data Provider:
 * Calculates real-time room occupancy and arrival/departure statuses for the selected target date.
 */
export async function getRoomBoardAction(hotelId: string, targetDateStr: string) {
  await requireHotelReadAccess(hotelId);

  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
  const normalizedTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const normalizedTargetTime = normalizedTarget.getTime();

  // Load all non-archived rooms
  const rooms = await prisma.room.findMany({
    where: { hotelId, isArchived: false },
    include: { roomType: true },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });

  // Load all reservations that could be relevant to the target date and future dates (up to 90 days)
  const startWindow = new Date(normalizedTarget);
  startWindow.setDate(startWindow.getDate() - 7);
  const endWindow = new Date(normalizedTarget);
  endWindow.setDate(endWindow.getDate() + 90);

  const reservations = await prisma.reservation.findMany({
    where: {
      hotelId,
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      checkInDate: { lte: endWindow },
      checkOutDate: { gte: startWindow },
    },
    include: {
      guest: { select: { fullName: true, mobile: true, email: true } },
    },
    orderBy: { checkInDate: "asc" },
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Map each room to its resolved board status and future bookings
  const boardTiles = rooms.map((room) => {
    const roomReservations = reservations
      .filter((res) => res.roomId === room.id)
      .map((res) => ({
        id: res.id,
        reservationNumber: res.reservationNumber,
        checkInDate: res.checkInDate,
        checkOutDate: res.checkOutDate,
        status: res.status,
        guestName: res.guest.fullName,
        guestMobile: res.guest.mobile,
      }));

    const resolved = resolveBoardStatusForDate({
      roomStatus: room.status,
      isArchived: room.isArchived,
      activeReservations: roomReservations,
      targetDate,
    });

    // Active future reservations (where checkout is after target date)
    const activeStays = roomReservations.filter((res) =>
      ["CONFIRMED", "CHECKED_IN", "PENDING"].includes(res.status)
    );

    const futureBookings = activeStays
      .filter((res) => {
        const outTime = new Date(
          res.checkOutDate.getFullYear(),
          res.checkOutDate.getMonth(),
          res.checkOutDate.getDate()
        ).getTime();
        return outTime > normalizedTargetTime;
      })
      .sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime())
      .map((res) => {
        const inDate = new Date(res.checkInDate);
        const outDate = new Date(res.checkOutDate);
        const inNorm = new Date(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
        const outNorm = new Date(outDate.getFullYear(), outDate.getMonth(), outDate.getDate());
        const nights = Math.max(1, Math.round((outNorm.getTime() - inNorm.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          id: res.id,
          reservationNumber: res.reservationNumber,
          checkInDate: inDate.toISOString(),
          checkOutDate: outDate.toISOString(),
          status: res.status,
          guestName: res.guestName,
          guestMobile: res.guestMobile,
          nights,
        };
      });

    // Next upcoming booking that starts strictly after targetDate
    const nextReservation = futureBookings.find((res) => {
      const inNorm = new Date(res.checkInDate);
      const inTime = new Date(inNorm.getFullYear(), inNorm.getMonth(), inNorm.getDate()).getTime();
      return inTime > normalizedTargetTime;
    });

    let nextBookingDate: string | null = null;
    let availableDaysUntilNext: number | null = null;

    if (nextReservation) {
      const nextIn = new Date(nextReservation.checkInDate);
      const nextInNormalized = new Date(nextIn.getFullYear(), nextIn.getMonth(), nextIn.getDate());
      nextBookingDate = nextInNormalized.toISOString();
      const diffMs = nextInNormalized.getTime() - normalizedTargetTime;
      availableDaysUntilNext = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    // 14-day timeline breakdown from targetDate
    const schedule14Days = [];
    for (let i = 0; i < 14; i++) {
      const cur = new Date(normalizedTarget);
      cur.setDate(cur.getDate() + i);
      const curTime = cur.getTime();

      const booking = activeStays.find((res) => {
        const inTime = new Date(res.checkInDate.getFullYear(), res.checkInDate.getMonth(), res.checkInDate.getDate()).getTime();
        const outTime = new Date(res.checkOutDate.getFullYear(), res.checkOutDate.getMonth(), res.checkOutDate.getDate()).getTime();
        return inTime <= curTime && curTime < outTime;
      });

      const isCheckinDay = activeStays.some((res) => {
        const inTime = new Date(res.checkInDate.getFullYear(), res.checkInDate.getMonth(), res.checkInDate.getDate()).getTime();
        return inTime === curTime;
      });

      const isCheckoutDay = activeStays.some((res) => {
        const outTime = new Date(res.checkOutDate.getFullYear(), res.checkOutDate.getMonth(), res.checkOutDate.getDate()).getTime();
        return outTime === curTime;
      });

      schedule14Days.push({
        dateStr: cur.toISOString().slice(0, 10),
        dayName: dayNames[cur.getDay()],
        dayNumber: cur.getDate(),
        monthName: monthNames[cur.getMonth()],
        isBooked: !!booking,
        isCheckinDay,
        isCheckoutDay,
        guestName: booking?.guestName,
        reservationNumber: booking?.reservationNumber,
        status: booking?.status,
      });
    }

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomType: room.roomType.name,
      basePrice: Number(room.roomType.basePrice),
      isClean: room.isClean,
      boardStatus: resolved.status,
      badgeColor: resolved.badgeColor,
      statusLabel: resolved.label,
      reservation: resolved.reservation
        ? {
            id: resolved.reservation.id,
            reservationNumber: resolved.reservation.reservationNumber,
            checkInDate: resolved.reservation.checkInDate.toISOString(),
            checkOutDate: resolved.reservation.checkOutDate.toISOString(),
            status: resolved.reservation.status,
            guestName: resolved.reservation.guestName,
          }
        : undefined,
      futureBookings,
      nextBookingDate,
      availableDaysUntilNext,
      schedule14Days,
    };
  });

  return {
    targetDate: targetDate.toISOString(),
    totalRooms: boardTiles.length,
    availableRooms: boardTiles.filter((t) => t.boardStatus === "AVAILABLE").length,
    occupiedRooms: boardTiles.filter((t) => t.boardStatus === "OCCUPIED").length,
    reservedRooms: boardTiles.filter((t) => t.boardStatus === "RESERVED").length,
    checkoutTodayRooms: boardTiles.filter((t) => t.boardStatus === "CHECKOUT_TODAY").length,
    arrivalTodayRooms: boardTiles.filter((t) => t.boardStatus === "ARRIVAL_TODAY").length,
    maintenanceRooms: boardTiles.filter((t) => t.boardStatus === "MAINTENANCE" || t.boardStatus === "OUT_OF_SERVICE").length,
    tiles: boardTiles,
  };
}
