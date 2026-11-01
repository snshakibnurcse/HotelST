"use server";

import prisma from "@/lib/prisma";
import { requireHotelReadAccess, requireManager } from "@/lib/auth/tenant";
import {
  checkRoomAvailability,
  calculateStayAmounts,
  generateReservationCode,
  generateInvoiceCode,
  generatePaymentCode,
} from "@/lib/booking";
import { logAuditEvent } from "@/lib/audit";
import { PaymentMethod, ReservationStatus, RoomStatus, InvoiceStatus, InvoiceItemType } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const reservationSchema = z.object({
  roomId: z.string().min(1, "Room is required"),
  // Guest details (either existing guestId or new guest fields)
  guestId: z.string().optional(),
  guestFullName: z.string().min(2, "Guest full name is required"),
  guestMobile: z.string().min(6, "Guest mobile number is required"),
  guestEmail: z.string().optional(),
  guestNid: z.string().optional(),
  guestAddress: z.string().optional(),

  bookingSource: z.string().default("WALK_IN"),
  checkInDate: z.string().min(10, "Check-in date required"),
  checkOutDate: z.string().min(10, "Checkout date required"),
  adultCount: z.number().int().min(1).default(1),
  childCount: z.number().int().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  additionalCharges: z.number().min(0).default(0),
  advancePaid: z.number().min(0).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  paymentRef: z.string().optional(),
  specialRequests: z.string().optional(),
});

export async function checkAvailabilityAction(
  hotelId: string,
  roomId: string,
  checkInDateStr: string,
  checkOutDateStr: string,
  excludeReservationId?: string
) {
  await requireHotelReadAccess(hotelId);
  const inDate = new Date(checkInDateStr);
  const outDate = new Date(checkOutDateStr);
  return checkRoomAvailability(roomId, inDate, outDate, excludeReservationId);
}

export async function createReservationAction(hotelId: string, rawData: z.infer<typeof reservationSchema>) {
  const manager = await requireManager(hotelId);
  const parsed = reservationSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const data = parsed.data;
  const inDate = new Date(data.checkInDate);
  const outDate = new Date(data.checkOutDate);

  try {
    // Execute inside a database transaction to prevent race conditions and concurrent double-bookings
    const result = await prisma.$transaction(async (tx) => {
      // 1. Concurrency-safe overlap check
      const availability = await checkRoomAvailability(data.roomId, inDate, outDate, undefined, tx);
      if (!availability.isAvailable) {
        throw new Error(availability.errorMessage || "Room is not available for the selected dates");
      }

      // 2. Room & Pricing
      const room = await tx.room.findUniqueOrThrow({
        where: { id: data.roomId },
        include: { roomType: true, hotel: true },
      });

      const hotelTaxRate = Number(room.hotel.taxRate || 0);
      const nightlyRate = Number(room.roomType.basePrice);

      const calculations = calculateStayAmounts({
        nightlyRate,
        totalNights: availability.totalNights,
        discountAmount: data.discountAmount,
        taxRatePercent: hotelTaxRate,
        additionalCharges: data.additionalCharges,
      });

      const advancePaid = data.advancePaid || 0;
      const outstandingBalance = Math.max(0, calculations.totalAmount - advancePaid);

      // 3. Guest profile resolution (find or create)
      let finalGuestId = data.guestId;
      if (!finalGuestId) {
        // Search by mobile inside this hotel
        const existingGuest = await tx.guest.findFirst({
          where: { hotelId, mobile: data.guestMobile.trim() },
        });

        if (existingGuest) {
          finalGuestId = existingGuest.id;
          // Optionally update NID/address if provided
          if (data.guestNid || data.guestAddress) {
            await tx.guest.update({
              where: { id: existingGuest.id },
              data: {
                ...(data.guestNid ? { nidPassport: data.guestNid } : {}),
                ...(data.guestAddress ? { address: data.guestAddress } : {}),
              },
            });
          }
        } else {
          const newGuest = await tx.guest.create({
            data: {
              hotelId,
              fullName: data.guestFullName.trim(),
              mobile: data.guestMobile.trim(),
              email: data.guestEmail?.trim() || null,
              nidPassport: data.guestNid?.trim() || null,
              address: data.guestAddress?.trim() || null,
            },
          });
          finalGuestId = newGuest.id;
        }
      }

      // 4. Create Reservation
      const reservationNumber = generateReservationCode();
      const reservation = await tx.reservation.create({
        data: {
          reservationNumber,
          hotelId,
          roomId: room.id,
          guestId: finalGuestId,
          bookingSource: data.bookingSource,
          checkInDate: inDate,
          checkOutDate: outDate,
          status: ReservationStatus.CONFIRMED,
          adultCount: data.adultCount,
          childCount: data.childCount,
          nightlyRateSnapshot: nightlyRate,
          totalNights: availability.totalNights,
          roomCharges: calculations.roomCharges,
          discountAmount: calculations.discountAmount,
          taxAmount: calculations.taxAmount,
          additionalCharges: calculations.additionalCharges,
          totalAmount: calculations.totalAmount,
          advancePaid,
          paidAmount: advancePaid,
          outstandingBalance,
          specialRequests: data.specialRequests || null,
          createdById: manager.userId,
        },
      });

      // 5. Create Invoice
      const invoiceNumber = generateInvoiceCode();
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          hotelId,
          reservationId: reservation.id,
          guestId: finalGuestId,
          subtotal: calculations.roomCharges,
          discountAmount: calculations.discountAmount,
          taxAmount: calculations.taxAmount,
          additionalCharges: calculations.additionalCharges,
          totalAmount: calculations.totalAmount,
          paidAmount: advancePaid,
          outstandingBalance,
          status:
            outstandingBalance === 0
              ? InvoiceStatus.PAID
              : advancePaid > 0
              ? InvoiceStatus.PARTIALLY_PAID
              : InvoiceStatus.ISSUED,
          createdById: manager.userId,
          items: {
            create: [
              {
                description: `${room.roomType.name} Room ${room.roomNumber} (${availability.totalNights} Nights @ ${nightlyRate} BDT)`,
                type: InvoiceItemType.ROOM_CHARGE,
                quantity: availability.totalNights,
                unitPrice: nightlyRate,
                totalPrice: calculations.roomCharges,
              },
              ...(data.additionalCharges > 0
                ? [
                    {
                      description: "Additional Guest / Service Charge",
                      type: InvoiceItemType.SERVICE,
                      quantity: 1,
                      unitPrice: data.additionalCharges,
                      totalPrice: data.additionalCharges,
                    },
                  ]
                : []),
            ],
          },
        },
      });

      // 6. Record Advance Payment if made
      if (advancePaid > 0) {
        const paymentNumber = generatePaymentCode();
        await tx.payment.create({
          data: {
            paymentNumber,
            hotelId,
            invoiceId: invoice.id,
            reservationId: reservation.id,
            amount: advancePaid,
            method: data.paymentMethod,
            transactionRef: data.paymentRef || null,
            notes: "Advance payment during booking creation",
            receivedById: manager.userId,
          },
        });
      }

      return { reservation, invoice };
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "RESERVATION_CREATED",
      entityType: "RESERVATION",
      entityId: result.reservation.id,
      metadata: {
        reservationNumber: result.reservation.reservationNumber,
        totalAmount: Number(result.reservation.totalAmount),
        advancePaid: data.advancePaid,
      },
    });

    revalidatePath("/dashboard/reservations");
    revalidatePath("/dashboard/rooms");
    return { success: true, reservation: result.reservation, invoiceId: result.invoice.id };
  } catch (err: unknown) {
    console.error("Booking error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create reservation" };
  }
}

export async function getReservationsAction(
  hotelId: string,
  filters?: {
    status?: ReservationStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }
) {
  await requireHotelReadAccess(hotelId);

  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;

  const whereClause: Record<string, unknown> = { hotelId };

  if (filters?.status) {
    whereClause.status = filters.status;
  }
  if (filters?.startDate && filters?.endDate) {
    whereClause.checkInDate = {
      gte: new Date(filters.startDate),
      lte: new Date(filters.endDate),
    };
  }
  if (filters?.search) {
    whereClause.OR = [
      { reservationNumber: { contains: filters.search } },
      { guest: { fullName: { contains: filters.search } } },
      { guest: { mobile: { contains: filters.search } } },
      { room: { roomNumber: { contains: filters.search } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.reservation.count({ where: whereClause }),
    prisma.reservation.findMany({
      where: whereClause,
      include: {
        guest: { select: { id: true, fullName: true, mobile: true, email: true } },
        room: { include: { roomType: true } },
        invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, paidAmount: true } },
      },
      orderBy: { checkInDate: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getReservationDetailsAction(hotelId: string, reservationId: string) {
  await requireHotelReadAccess(hotelId);

  const res = await prisma.reservation.findFirst({
    where: { id: reservationId, hotelId },
    include: {
      guest: true,
      room: { include: { roomType: true } },
      invoices: {
        include: {
          items: true,
          payments: {
            include: {
              receivedBy: { select: { fullName: true } },
            },
          },
        },
      },
      payments: {
        include: {
          receivedBy: { select: { fullName: true } },
        },
      },
      createdBy: { select: { fullName: true, email: true } },
    },
  });

  if (!res) throw new Error("Reservation not found");
  return res;
}

export async function cancelReservationAction(hotelId: string, reservationId: string, reason: string) {
  const manager = await requireManager(hotelId);

  const res = await prisma.reservation.findFirst({
    where: { id: reservationId, hotelId },
    include: { room: true },
  });

  if (!res) return { success: false, error: "Reservation not found" };

  if (res.status === ReservationStatus.CHECKED_IN) {
    return { success: false, error: "Cannot cancel a guest who is currently checked in. Please check out or adjust stay." };
  }
  if (res.status === ReservationStatus.CANCELLED) {
    return { success: false, error: "Reservation is already cancelled." };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CANCELLED,
        cancellationReason: reason || "Cancelled by manager",
      },
    });

    // Void associated unpaid or draft invoices
    await tx.invoice.updateMany({
      where: { reservationId, status: { in: ["DRAFT", "ISSUED"] } },
      data: { status: InvoiceStatus.VOIDED },
    });

    return cancelled;
  });

  await logAuditEvent({
    actorId: manager.userId,
    hotelId,
    action: "RESERVATION_CANCELLED",
    entityType: "RESERVATION",
    entityId: reservationId,
    metadata: { reason },
  });

  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/rooms");
  return { success: true, reservation: updated };
}

export async function checkInGuestAction(
  hotelId: string,
  reservationId: string,
  advanceCollection?: { amount: number; method: PaymentMethod; ref?: string }
) {
  const manager = await requireManager(hotelId);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.reservation.findFirstOrThrow({
        where: { id: reservationId, hotelId },
        include: { room: true, invoices: true },
      });

      if (res.status === ReservationStatus.CHECKED_IN) {
        throw new Error("Guest is already checked in");
      }
      if (res.status === ReservationStatus.CANCELLED) {
        throw new Error("Cannot check in a cancelled reservation");
      }
      if (res.status === ReservationStatus.CHECKED_OUT) {
        throw new Error("Cannot check in a completed stay");
      }

      // Collect payment if provided at check-in desk
      let addedPaid = 0;
      if (advanceCollection && advanceCollection.amount > 0) {
        addedPaid = advanceCollection.amount;
        const mainInvoice = res.invoices[0];
        const payNum = generatePaymentCode();

        await tx.payment.create({
          data: {
            paymentNumber: payNum,
            hotelId,
            reservationId: res.id,
            invoiceId: mainInvoice?.id || null,
            amount: addedPaid,
            method: advanceCollection.method,
            transactionRef: advanceCollection.ref || null,
            notes: "Collected at check-in",
            receivedById: manager.userId,
          },
        });

        if (mainInvoice) {
          const newPaid = Number(mainInvoice.paidAmount) + addedPaid;
          const newBal = Math.max(0, Number(mainInvoice.totalAmount) - newPaid);
          await tx.invoice.update({
            where: { id: mainInvoice.id },
            data: {
              paidAmount: newPaid,
              outstandingBalance: newBal,
              status: newBal === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
            },
          });
        }
      }

      const totalPaidNow = Number(res.paidAmount) + addedPaid;
      const outstandingNow = Math.max(0, Number(res.totalAmount) - totalPaidNow);

      // Update reservation to CHECKED_IN
      const updatedRes = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CHECKED_IN,
          actualCheckIn: new Date(),
          paidAmount: totalPaidNow,
          outstandingBalance: outstandingNow,
        },
      });

      // Mark room as OCCUPIED
      await tx.room.update({
        where: { id: res.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      return updatedRes;
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "GUEST_CHECKED_IN",
      entityType: "RESERVATION",
      entityId: reservationId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reservations");
    revalidatePath("/dashboard/rooms");
    return { success: true, reservation: updated };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to check in guest" };
  }
}

export async function checkOutGuestAction(
  hotelId: string,
  reservationId: string,
  finalSettlement?: { amount: number; method: PaymentMethod; ref?: string; notes?: string },
  options?: { adjustNightsForEarlyCheckout?: boolean }
) {
  const manager = await requireManager(hotelId);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.reservation.findFirstOrThrow({
        where: { id: reservationId, hotelId },
        include: { room: true, invoices: { include: { items: true } }, hotel: true },
      });

      if (res.status !== ReservationStatus.CHECKED_IN) {
        throw new Error("Guest must be currently checked in to perform checkout.");
      }

      const mainInvoice = res.invoices[0];
      let currentTotalAmount = Number(res.totalAmount);
      let adjustedNights = res.totalNights;

      // Handle Early Check-Out Bill Adjustment
      const now = new Date();
      const inDateNorm = new Date(res.checkInDate.getFullYear(), res.checkInDate.getMonth(), res.checkInDate.getDate());
      const todayNorm = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const schedOutNorm = new Date(res.checkOutDate.getFullYear(), res.checkOutDate.getMonth(), res.checkOutDate.getDate());

      const isEarlyCheckout = todayNorm.getTime() < schedOutNorm.getTime();

      if (isEarlyCheckout && options?.adjustNightsForEarlyCheckout !== false) {
        const diffDays = Math.round((todayNorm.getTime() - inDateNorm.getTime()) / (1000 * 60 * 60 * 24));
        adjustedNights = Math.max(1, diffDays);

        if (adjustedNights < res.totalNights && mainInvoice) {
          const nightlyRate = Number(res.nightlyRateSnapshot);
          const newRoomCharges = adjustedNights * nightlyRate;
          const hotelTaxRate = Number(res.hotel?.taxRate || 0);

          // Update primary room charge line item
          const roomItem = mainInvoice.items.find((item) => item.type === InvoiceItemType.ROOM_CHARGE);
          if (roomItem) {
            await tx.invoiceItem.update({
              where: { id: roomItem.id },
              data: {
                quantity: adjustedNights,
                totalPrice: newRoomCharges,
                description: `Room Stay - ${adjustedNights} night(s) @ ${nightlyRate}/nt (Early departure adjusted)`,
              },
            });
          }

          const otherItems = mainInvoice.items.filter((item) => item.id !== roomItem?.id);
          const otherItemsTotal = otherItems.reduce((acc, it) => acc + Number(it.totalPrice), 0);

          const newSubtotal = newRoomCharges + otherItemsTotal;
          const newTax = Math.round((newSubtotal * (hotelTaxRate / 100)) * 100) / 100;
          currentTotalAmount = newSubtotal + newTax - Number(res.discountAmount);

          await tx.reservation.update({
            where: { id: reservationId },
            data: {
              totalNights: adjustedNights,
              roomCharges: newRoomCharges,
              taxAmount: newTax,
              totalAmount: currentTotalAmount,
              checkOutDate: todayNorm,
            },
          });
        }
      }

      let finalPaid = Number(res.paidAmount);

      // Settle any remaining balance
      if (finalSettlement && finalSettlement.amount > 0) {
        const payNum = generatePaymentCode();
        await tx.payment.create({
          data: {
            paymentNumber: payNum,
            hotelId,
            reservationId: res.id,
            invoiceId: mainInvoice?.id || null,
            amount: finalSettlement.amount,
            method: finalSettlement.method,
            transactionRef: finalSettlement.ref || null,
            notes: finalSettlement.notes || "Final checkout settlement",
            receivedById: manager.userId,
          },
        });

        finalPaid += finalSettlement.amount;
      }

      const finalOutstanding = Math.max(0, currentTotalAmount - finalPaid);

      if (mainInvoice) {
        await tx.invoice.update({
          where: { id: mainInvoice.id },
          data: {
            totalAmount: currentTotalAmount,
            paidAmount: finalPaid,
            outstandingBalance: finalOutstanding,
            status: finalOutstanding === 0 ? InvoiceStatus.PAID : (finalPaid > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.ISSUED),
          },
        });
      }

      // Update reservation to CHECKED_OUT
      const updatedRes = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.CHECKED_OUT,
          actualCheckOut: now,
          paidAmount: finalPaid,
          outstandingBalance: finalOutstanding,
          totalAmount: currentTotalAmount,
        },
      });

      // Mark room as AVAILABLE but requires housekeeping (isClean: false)
      await tx.room.update({
        where: { id: res.roomId },
        data: {
          status: RoomStatus.AVAILABLE,
          isClean: false, // flag for housekeeping before next check-in
        },
      });

      return updatedRes;
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "GUEST_CHECKED_OUT",
      entityType: "RESERVATION",
      entityId: reservationId,
      metadata: { earlyCheckoutAdjusted: options?.adjustNightsForEarlyCheckout !== false },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reservations");
    revalidatePath("/dashboard/room-board");
    revalidatePath("/dashboard/rooms");
    revalidatePath("/dashboard/invoices");
    return { success: true, reservation: updated };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to check out guest" };
  }
}

/**
 * Stay Extension Action:
 * Supports extending in the SAME room or moving to a DIFFERENT room.
 * Extends the stay and appends extra room charges to the SINGLE existing Master Invoice.
 */
export async function extendReservationAction(
  hotelId: string,
  reservationId: string,
  data: {
    newCheckOutDateStr: string;
    targetRoomId?: string; // If moving to another room for the extension
  }
) {
  const manager = await requireManager(hotelId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const res = await tx.reservation.findFirstOrThrow({
        where: { id: reservationId, hotelId },
        include: { room: { include: { roomType: true } }, invoices: { include: { items: true } }, hotel: true },
      });

      if (!["CONFIRMED", "CHECKED_IN"].includes(res.status)) {
        throw new Error("Only confirmed or checked-in reservations can be extended.");
      }

      const currentCheckOut = new Date(res.checkOutDate);
      const newCheckOut = new Date(data.newCheckOutDateStr);
      const currentCheckOutNorm = new Date(currentCheckOut.getFullYear(), currentCheckOut.getMonth(), currentCheckOut.getDate());
      const newCheckOutNorm = new Date(newCheckOut.getFullYear(), newCheckOut.getMonth(), newCheckOut.getDate());

      if (newCheckOutNorm.getTime() <= currentCheckOutNorm.getTime()) {
        throw new Error("New checkout date must be after current scheduled checkout date.");
      }

      const extraNights = Math.round((newCheckOutNorm.getTime() - currentCheckOutNorm.getTime()) / (1000 * 60 * 60 * 24));
      if (extraNights <= 0) {
        throw new Error("Extension must be for at least 1 additional night.");
      }

      const mainInvoice = res.invoices[0];
      if (!mainInvoice) {
        throw new Error("No active invoice found for this reservation.");
      }

      const isRoomMove = data.targetRoomId && data.targetRoomId !== res.roomId;
      let effectiveRate = Number(res.nightlyRateSnapshot);
      let newRoomNumber = res.room.roomNumber;

      if (isRoomMove) {
        // Case B: Room Move Extension
        const targetRoom = await tx.room.findUniqueOrThrow({
          where: { id: data.targetRoomId },
          include: { roomType: true },
        });

        // Verify target room is available from old checkout date to new checkout date
        const targetAvail = await checkRoomAvailability(data.targetRoomId!, currentCheckOutNorm, newCheckOutNorm, undefined, tx);
        if (!targetAvail.isAvailable) {
          throw new Error(`Target Room #${targetRoom.roomNumber} is not available for extension dates (${targetAvail.errorMessage || "Overlap with booking"}).`);
        }

        effectiveRate = Number(targetRoom.roomType.basePrice);
        newRoomNumber = targetRoom.roomNumber;
        const extraRoomCharge = extraNights * effectiveRate;

        // Add line item to EXISTING Master Invoice
        await tx.invoiceItem.create({
          data: {
            invoiceId: mainInvoice.id,
            description: `Room Move Extension: Room #${targetRoom.roomNumber} (${targetRoom.roomType.name}) — ${extraNights} night(s) @ ${effectiveRate}/nt`,
            type: InvoiceItemType.ROOM_CHARGE,
            quantity: extraNights,
            unitPrice: effectiveRate,
            totalPrice: extraRoomCharge,
          },
        });

        const newSubtotal = Number(mainInvoice.subtotal) + extraRoomCharge;
        const hotelTaxRate = Number(res.hotel?.taxRate || 0);
        const newTax = Math.round((newSubtotal * (hotelTaxRate / 100)) * 100) / 100;
        const newTotal = newSubtotal + newTax - Number(res.discountAmount);
        const newBalance = Math.max(0, newTotal - Number(mainInvoice.paidAmount));

        await tx.invoice.update({
          where: { id: mainInvoice.id },
          data: {
            subtotal: newSubtotal,
            taxAmount: newTax,
            totalAmount: newTotal,
            outstandingBalance: newBalance,
            status: newBalance === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
          },
        });

        const updatedRes = await tx.reservation.update({
          where: { id: reservationId },
          data: {
            checkOutDate: newCheckOutNorm,
            totalNights: res.totalNights + extraNights,
            roomCharges: Number(res.roomCharges) + extraRoomCharge,
            taxAmount: newTax,
            totalAmount: newTotal,
            outstandingBalance: newBalance,
            specialRequests: (res.specialRequests ? res.specialRequests + " | " : "") + `Room Move: Shifted to #${targetRoom.roomNumber} for ${extraNights} night(s)`,
          },
        });

        return { success: true, reservation: updatedRes, extraNights, newTotal, roomMoved: true, newRoomNumber };
      } else {
        // Case A: Same Room Extension
        const avail = await checkRoomAvailability(res.roomId, currentCheckOutNorm, newCheckOutNorm, res.id, tx);
        if (!avail.isAvailable) {
          throw new Error(`Room #${res.room.roomNumber} is already booked for upcoming dates. Please select an alternate room for room move extension.`);
        }

        const extraRoomCharge = extraNights * effectiveRate;
        const newTotalNights = res.totalNights + extraNights;

        // Add line item to EXISTING Master Invoice
        await tx.invoiceItem.create({
          data: {
            invoiceId: mainInvoice.id,
            description: `Stay Extension: Room #${res.room.roomNumber} — ${extraNights} extra night(s) @ ${effectiveRate}/nt`,
            type: InvoiceItemType.ROOM_CHARGE,
            quantity: extraNights,
            unitPrice: effectiveRate,
            totalPrice: extraRoomCharge,
          },
        });

        const newSubtotal = Number(mainInvoice.subtotal) + extraRoomCharge;
        const hotelTaxRate = Number(res.hotel?.taxRate || 0);
        const newTax = Math.round((newSubtotal * (hotelTaxRate / 100)) * 100) / 100;
        const newTotal = newSubtotal + newTax - Number(res.discountAmount);
        const newBalance = Math.max(0, newTotal - Number(mainInvoice.paidAmount));

        await tx.invoice.update({
          where: { id: mainInvoice.id },
          data: {
            subtotal: newSubtotal,
            taxAmount: newTax,
            totalAmount: newTotal,
            outstandingBalance: newBalance,
            status: newBalance === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID,
          },
        });

        const updatedRes = await tx.reservation.update({
          where: { id: reservationId },
          data: {
            checkOutDate: newCheckOutNorm,
            totalNights: newTotalNights,
            roomCharges: Number(res.roomCharges) + extraRoomCharge,
            taxAmount: newTax,
            totalAmount: newTotal,
            outstandingBalance: newBalance,
          },
        });

        return { success: true, reservation: updatedRes, extraNights, newTotal, roomMoved: false, newRoomNumber };
      }
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "RESERVATION_EXTENDED",
      entityType: "RESERVATION",
      entityId: reservationId,
      metadata: { newCheckOutDate: data.newCheckOutDateStr, targetRoomId: data.targetRoomId },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reservations");
    revalidatePath("/dashboard/room-board");
    revalidatePath("/dashboard/rooms");
    revalidatePath("/dashboard/invoices");

    return result;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to extend stay" };
  }
}
