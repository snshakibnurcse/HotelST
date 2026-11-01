"use server";

import prisma from "@/lib/prisma";
import { requireHotelReadAccess, requireManager, requireUser, getAuthorizedHotels } from "@/lib/auth/tenant";
import { generateTransactionCode } from "@/lib/booking";
import { logAuditEvent } from "@/lib/audit";
import { PaymentMethod, TransactionType } from "@prisma/client";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const transactionSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  type: z.nativeEnum(TransactionType),
  amount: z.number().positive("Amount must be greater than zero"),
  transactionDate: z.string().min(10, "Transaction date is required"),
  description: z.string().min(2, "Description is required"),
  reference: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
});

export async function getFinancialCategoriesAction(hotelId: string) {
  await requireHotelReadAccess(hotelId);
  return prisma.financialCategory.findMany({
    where: {
      OR: [{ hotelId }, { hotelId: null }],
    },
    orderBy: { name: "asc" },
  });
}

export async function getFinancialTransactionsAction(
  hotelId: string,
  filters?: {
    type?: TransactionType;
    categoryId?: string;
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

  if (filters?.type) whereClause.type = filters.type;
  if (filters?.categoryId && filters.categoryId !== "ALL") whereClause.categoryId = filters.categoryId;
  if (filters?.startDate && filters?.endDate) {
    whereClause.transactionDate = {
      gte: startOfDay(new Date(filters.startDate)),
      lte: endOfDay(new Date(filters.endDate)),
    };
  }

  const [total, items] = await Promise.all([
    prisma.financialTransaction.count({ where: whereClause }),
    prisma.financialTransaction.findMany({
      where: whereClause,
      include: {
        category: true,
        createdBy: { select: { fullName: true } },
      },
      orderBy: { transactionDate: "desc" },
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

export async function createFinancialTransactionAction(
  hotelId: string,
  rawData: z.infer<typeof transactionSchema>
) {
  const manager = await requireManager(hotelId);
  const parsed = transactionSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const data = parsed.data;

  try {
    const code = generateTransactionCode(data.type === "INCOME" ? "INC" : "EXP");
    const tx = await prisma.financialTransaction.create({
      data: {
        transactionNumber: code,
        hotelId,
        categoryId: data.categoryId,
        type: data.type,
        amount: data.amount,
        transactionDate: new Date(data.transactionDate),
        description: data.description,
        reference: data.reference || null,
        paymentMethod: data.paymentMethod,
        createdById: manager.userId,
      },
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: data.type === "INCOME" ? "INCOME_RECORDED" : "EXPENSE_RECORDED",
      entityType: "FINANCIAL_TRANSACTION",
      entityId: tx.id,
      metadata: { transactionNumber: tx.transactionNumber, amount: data.amount },
    });

    revalidatePath("/dashboard/financials");
    return { success: true, transaction: tx };
  } catch (err: unknown) {
    console.error("Failed to record transaction:", err);
    return { success: false, error: "Failed to record financial transaction." };
  }
}

export async function reverseFinancialTransactionAction(
  hotelId: string,
  transactionId: string,
  reversalReason: string
) {
  const manager = await requireManager(hotelId);

  try {
    const tx = await prisma.financialTransaction.findFirst({
      where: { id: transactionId, hotelId },
    });

    if (!tx) return { success: false, error: "Transaction not found" };
    if (tx.isReversed) return { success: false, error: "Transaction has already been reversed" };

    const updated = await prisma.financialTransaction.update({
      where: { id: transactionId },
      data: {
        isReversed: true,
        reversalReason: reversalReason || "Audited reversal by manager",
      },
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "FINANCIAL_TRANSACTION_REVERSED",
      entityType: "FINANCIAL_TRANSACTION",
      entityId: transactionId,
      metadata: { reversalReason },
    });

    revalidatePath("/dashboard/financials");
    return { success: true, transaction: updated };
  } catch (err) {
    console.error("Failed to reverse transaction:", err);
    return { success: false, error: "Database error during transaction reversal" };
  }
}

import { resolveDateRange, DateFilterType } from "@/lib/utils";
export type { DateFilterType };

/**
 * Main Hotel Dashboard & Portfolio Financial Analytics Loader:
 * Fully connected to real database queries.
 * Correctly distinguishes:
 * - Room revenue recognized vs collected cash/bank payments
 * - Operational expenses vs net operating result
 * - Outstanding receivables
 */
export async function getDashboardMetricsAction({
  hotelId,
  dateFilter = "this_month",
  customStart,
  customEnd,
}: {
  hotelId?: string | null;
  dateFilter?: DateFilterType;
  customStart?: string;
  customEnd?: string;
}) {
  const user = await requireUser();
  const dateRange = resolveDateRange(dateFilter, customStart, customEnd);

  // If no specific hotelId is provided or if "ALL" is selected, determine permitted hotels
  let targetHotelIds: string[] = [];
  if (hotelId && hotelId !== "ALL") {
    await requireHotelReadAccess(hotelId);
    targetHotelIds = [hotelId];
  } else {
    const authHotels = await getAuthorizedHotels(user);
    targetHotelIds = authHotels.map((h) => h.id);
  }

  if (targetHotelIds.length === 0) {
    return null;
  }

  const hotelFilter = { in: targetHotelIds };

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // 1. Room Status Counts
  const [totalRooms, availableRooms, occupiedRooms, maintenanceRooms] = await Promise.all([
    prisma.room.count({ where: { hotelId: hotelFilter, isArchived: false } }),
    prisma.room.count({ where: { hotelId: hotelFilter, isArchived: false, status: "AVAILABLE" } }),
    prisma.room.count({ where: { hotelId: hotelFilter, isArchived: false, status: "OCCUPIED" } }),
    prisma.room.count({
      where: {
        hotelId: hotelFilter,
        isArchived: false,
        status: { in: ["MAINTENANCE", "OUT_OF_SERVICE"] },
      },
    }),
  ]);

  // 2. Today's scheduled arrivals and departures
  const [todayArrivalsCount, todayDeparturesCount] = await Promise.all([
    prisma.reservation.count({
      where: {
        hotelId: hotelFilter,
        checkInDate: { gte: todayStart, lte: todayEnd },
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    }),
    prisma.reservation.count({
      where: {
        hotelId: hotelFilter,
        checkOutDate: { gte: todayStart, lte: todayEnd },
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
      },
    }),
  ]);

  // 3. Period Revenue Recognition (Reservations booked/created in period)
  const reservationsInPeriod = await prisma.reservation.findMany({
    where: {
      hotelId: hotelFilter,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
      status: { not: "CANCELLED" },
    },
    select: {
      roomCharges: true,
      additionalCharges: true,
      discountAmount: true,
      taxAmount: true,
      totalAmount: true,
      paidAmount: true,
      outstandingBalance: true,
    },
  });

  const recognizedRoomRevenue = reservationsInPeriod.reduce((sum, r) => sum + Number(r.roomCharges), 0);
  const periodTotalInvoiced = reservationsInPeriod.reduce((sum, r) => sum + Number(r.totalAmount), 0);

  // 4. Actual Collected Payments in Period (Cash flow received via Cash, bKash, Card, Bank)
  const paymentsInPeriod = await prisma.payment.findMany({
    where: {
      hotelId: hotelFilter,
      paymentDate: { gte: dateRange.start, lte: dateRange.end },
    },
    select: { amount: true, method: true, paymentDate: true },
  });

  const collectedCashPayments = paymentsInPeriod.reduce((sum, p) => sum + Number(p.amount), 0);

  // 5. Operating Expenses in Period (excluding reversed ones)
  const expensesInPeriod = await prisma.financialTransaction.findMany({
    where: {
      hotelId: hotelFilter,
      type: "EXPENSE",
      isReversed: false,
      transactionDate: { gte: dateRange.start, lte: dateRange.end },
    },
    include: { category: true },
  });

  const totalExpenses = expensesInPeriod.reduce((sum, e) => sum + Number(e.amount), 0);

  // 6. Non-Folio Other Income in Period (e.g. banquet hall, direct store sales)
  const otherIncomeInPeriod = await prisma.financialTransaction.findMany({
    where: {
      hotelId: hotelFilter,
      type: "INCOME",
      isReversed: false,
      transactionDate: { gte: dateRange.start, lte: dateRange.end },
    },
    include: { category: true },
  });

  const totalOtherIncome = otherIncomeInPeriod.reduce((sum, i) => sum + Number(i.amount), 0);

  // Total Gross Revenue = Recognized Invoiced Room/Service Revenue + Non-Folio Income
  const totalRevenue = periodTotalInvoiced + totalOtherIncome;
  // Net Operating Result = Total Revenue - Operating Expenses
  const netOperatingResult = totalRevenue - totalExpenses;

  // 7. Overall Outstanding Accounts Receivable (Guest Balances)
  const outstandingAggregate = await prisma.reservation.aggregate({
    where: {
      hotelId: hotelFilter,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    _sum: { outstandingBalance: true },
  });
  const outstandingGuestBalances = Number(outstandingAggregate._sum.outstandingBalance || 0);

  // 8. Occupancy Percentage
  const occupancyPercentage =
    totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;

  // 9. Recent Reservations (last 5)
  const recentReservations = await prisma.reservation.findMany({
    where: { hotelId: hotelFilter },
    include: {
      guest: { select: { fullName: true, mobile: true } },
      room: { select: { roomNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // 10. Recent Payments (last 5)
  const recentPayments = await prisma.payment.findMany({
    where: { hotelId: hotelFilter },
    include: {
      reservation: {
        include: { guest: { select: { fullName: true } } },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: 5,
  });

  // 11. Category-wise expense breakdown for chart
  const expenseByCategoryMap: Record<string, number> = {};
  for (const exp of expensesInPeriod) {
    const catName = exp.category.name;
    expenseByCategoryMap[catName] = (expenseByCategoryMap[catName] || 0) + Number(exp.amount);
  }

  const expenseBreakdown = Object.entries(expenseByCategoryMap).map(([name, value]) => ({
    name,
    value,
  }));

  // 12. Payment method breakdown
  const paymentMethodMap: Record<string, number> = {};
  for (const pay of paymentsInPeriod) {
    paymentMethodMap[pay.method] = (paymentMethodMap[pay.method] || 0) + Number(pay.amount);
  }
  const paymentBreakdown = Object.entries(paymentMethodMap).map(([name, value]) => ({
    method: name,
    total: value,
  }));

  return {
    period: {
      filter: dateFilter,
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
    rooms: {
      total: totalRooms,
      available: availableRooms,
      occupied: occupiedRooms,
      maintenance: maintenanceRooms,
      occupancyPercentage,
      todayArrivals: todayArrivalsCount,
      todayDepartures: todayDeparturesCount,
    },
    financials: {
      recognizedRoomRevenue,
      periodTotalInvoiced,
      totalOtherIncome,
      totalRevenue,
      collectedCashPayments,
      totalExpenses,
      netOperatingResult,
      outstandingGuestBalances,
    },
    recentReservations,
    recentPayments,
    expenseBreakdown,
    paymentBreakdown,
  };
}
