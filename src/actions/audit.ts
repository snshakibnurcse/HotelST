"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireHotelReadAccess, requireUser } from "@/lib/auth/tenant";

export async function getAuditLogsAction(filters?: {
  hotelId?: string;
  entityType?: string;
  limit?: number;
}) {
  const user = await requireUser();

  const whereClause: Record<string, unknown> = {};

  if (user.role === "ADMIN") {
    if (filters?.hotelId && filters.hotelId !== "ALL") {
      whereClause.hotelId = filters.hotelId;
    }
  } else if (user.role === "MANAGER") {
    if (!filters?.hotelId) {
      throw new Error("Hotel ID is required for Manager log inspection");
    }
    await requireHotelReadAccess(filters.hotelId);
    whereClause.hotelId = filters.hotelId;
  } else {
    throw new Error("Investors do not have access to system audit logs");
  }

  if (filters?.entityType && filters.entityType !== "ALL") {
    whereClause.entityType = filters.entityType;
  }

  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    include: {
      actor: { select: { fullName: true, email: true, role: true } },
      hotel: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit || 100,
  });

  return logs;
}
