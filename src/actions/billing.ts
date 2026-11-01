"use server";

import prisma from "@/lib/prisma";
import { requireHotelReadAccess, requireManager } from "@/lib/auth/tenant";
import { generatePaymentCode } from "@/lib/booking";
import { logAuditEvent } from "@/lib/audit";
import { PaymentMethod, InvoiceStatus, InvoiceItemType } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.number().positive("Payment amount must be greater than 0"),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  transactionRef: z.string().optional(),
  notes: z.string().optional(),
});

const invoiceItemSchema = z.object({
  description: z.string().min(2, "Description required"),
  type: z.nativeEnum(InvoiceItemType).default(InvoiceItemType.SERVICE),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().positive("Unit price must be positive"),
});

export async function getInvoicesAction(
  hotelId: string,
  filters?: {
    status?: InvoiceStatus;
    search?: string;
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
  if (filters?.search) {
    whereClause.OR = [
      { invoiceNumber: { contains: filters.search } },
      { guest: { fullName: { contains: filters.search } } },
      { guest: { mobile: { contains: filters.search } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.invoice.count({ where: whereClause }),
    prisma.invoice.findMany({
      where: whereClause,
      include: {
        guest: { select: { fullName: true, mobile: true } },
        reservation: {
          select: {
            reservationNumber: true,
            checkInDate: true,
            checkOutDate: true,
            room: { select: { roomNumber: true } },
          },
        },
        _count: { select: { payments: true } },
      },
      orderBy: { issueDate: "desc" },
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

export async function getInvoiceDetailsAction(hotelId: string, invoiceId: string) {
  await requireHotelReadAccess(hotelId);

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, hotelId },
    include: {
      hotel: true,
      guest: true,
      reservation: {
        include: {
          room: { include: { roomType: true } },
        },
      },
      items: true,
      payments: {
        include: {
          receivedBy: { select: { fullName: true, email: true } },
        },
        orderBy: { paymentDate: "asc" },
      },
      createdBy: { select: { fullName: true } },
    },
  });

  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

export async function recordPaymentAction(hotelId: string, rawData: z.infer<typeof paymentSchema>) {
  const manager = await requireManager(hotelId);
  const parsed = paymentSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { invoiceId, amount, method, transactionRef, notes } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirstOrThrow({
        where: { id: invoiceId, hotelId },
        include: { reservation: true },
      });

      if (invoice.status === InvoiceStatus.PAID) {
        throw new Error("This invoice is already fully paid.");
      }
      if (invoice.status === InvoiceStatus.VOIDED) {
        throw new Error("Cannot add payments to a voided invoice.");
      }

      const currentBalance = Number(invoice.outstandingBalance);
      if (amount > currentBalance) {
        throw new Error(`Payment amount (${amount}) exceeds the remaining balance (${currentBalance}).`);
      }

      const paymentNumber = generatePaymentCode();
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          hotelId,
          invoiceId: invoice.id,
          reservationId: invoice.reservationId || null,
          amount,
          method,
          transactionRef: transactionRef || null,
          notes: notes || null,
          receivedById: manager.userId,
        },
      });

      const newPaid = Number(invoice.paidAmount) + amount;
      const newBal = Math.max(0, Number(invoice.totalAmount) - newPaid);
      const newStatus = newBal === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaid,
          outstandingBalance: newBal,
          status: newStatus,
        },
      });

      // Synchronize reservation paid & outstanding amounts if linked
      if (invoice.reservationId) {
        await tx.reservation.update({
          where: { id: invoice.reservationId },
          data: {
            paidAmount: newPaid,
            outstandingBalance: newBal,
          },
        });
      }

      return { payment, invoice: updatedInvoice };
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "PAYMENT_RECORDED",
      entityType: "PAYMENT",
      entityId: result.payment.id,
      metadata: {
        paymentNumber: result.payment.paymentNumber,
        amount,
        method,
        invoiceNumber: result.invoice.invoiceNumber,
      },
    });

    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/reservations");
    return { success: true, payment: result.payment, invoice: result.invoice };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record payment" };
  }
}

export async function addInvoiceItemAction(
  hotelId: string,
  invoiceId: string,
  rawData: z.infer<typeof invoiceItemSchema>
) {
  const manager = await requireManager(hotelId);
  const parsed = invoiceItemSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { description, type, quantity, unitPrice } = parsed.data;
  const totalPrice = quantity * unitPrice;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirstOrThrow({
        where: { id: invoiceId, hotelId },
      });

      if (invoice.status === InvoiceStatus.VOIDED) {
        throw new Error("Cannot add items to a voided invoice");
      }

      const item = await tx.invoiceItem.create({
        data: {
          invoiceId,
          description,
          type,
          quantity,
          unitPrice,
          totalPrice,
        },
      });

      const newAdditional = Number(invoice.additionalCharges) + totalPrice;
      const newTotal = Number(invoice.totalAmount) + totalPrice;
      const newOutstanding = Math.max(0, newTotal - Number(invoice.paidAmount));
      const newStatus =
        newOutstanding === 0
          ? InvoiceStatus.PAID
          : Number(invoice.paidAmount) > 0
          ? InvoiceStatus.PARTIALLY_PAID
          : InvoiceStatus.ISSUED;

      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          additionalCharges: newAdditional,
          totalAmount: newTotal,
          outstandingBalance: newOutstanding,
          status: newStatus,
        },
      });

      if (inv.reservationId) {
        await tx.reservation.update({
          where: { id: inv.reservationId },
          data: {
            additionalCharges: newAdditional,
            totalAmount: newTotal,
            outstandingBalance: newOutstanding,
          },
        });
      }

      return { item, invoice: inv };
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "INVOICE_ITEM_ADDED",
      entityType: "INVOICE",
      entityId: invoiceId,
      metadata: { description, totalPrice },
    });

    revalidatePath("/dashboard/invoices");
    return { success: true, item: updated.item, invoice: updated.invoice };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add invoice item" };
  }
}
