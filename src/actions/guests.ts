"use server";

import prisma from "@/lib/prisma";
import { requireHotelReadAccess, requireManager, requireUser } from "@/lib/auth/tenant";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const guestSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  mobile: z.string().min(6, "Valid mobile number is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  nidPassport: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  country: z.string().default("Bangladesh"),
  nationality: z.string().default("Bangladeshi"),
  emergencyContact: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

import { maskNid } from "@/lib/utils";

export async function getGuestsAction(hotelId: string, search?: string) {
  const user = await requireHotelReadAccess(hotelId);

  const whereClause: Record<string, unknown> = { hotelId };

  if (search && search.trim()) {
    const q = search.trim();
    whereClause.OR = [
      { fullName: { contains: q } },
      { mobile: { contains: q } },
      { nidPassport: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const guests = await prisma.guest.findMany({
    where: whereClause,
    include: {
      _count: {
        select: {
          reservations: true,
          invoices: true,
        },
      },
      reservations: {
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true,
          outstandingBalance: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return guests.map((g) => {
    const totalSpent = g.reservations.reduce((acc, r) => acc + Number(r.totalAmount), 0);
    const totalOutstanding = g.reservations.reduce((acc, r) => acc + Number(r.outstandingBalance), 0);

    return {
      id: g.id,
      hotelId: g.hotelId,
      fullName: g.fullName,
      mobile: g.mobile,
      email: g.email,
      // Mask NID for general list view or investor views
      nidMasked: maskNid(g.nidPassport),
      city: g.city,
      country: g.country,
      totalStays: g._count.reservations,
      totalSpent,
      totalOutstanding,
      createdAt: g.createdAt,
    };
  });
}

export async function getGuestDetailsAction(hotelId: string, guestId: string) {
  const user = await requireHotelReadAccess(hotelId);

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, hotelId },
    include: {
      reservations: {
        include: {
          room: { include: { roomType: true } },
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              paidAmount: true,
              status: true,
              issueDate: true,
            },
          },
          payments: {
            select: {
              id: true,
              paymentNumber: true,
              amount: true,
              method: true,
              paymentDate: true,
            },
          },
        },
        orderBy: { checkInDate: "desc" },
      },
      invoices: {
        include: {
          items: true,
          payments: true,
        },
        orderBy: { issueDate: "desc" },
      },
    },
  });

  if (!guest) throw new Error("Guest not found");

  // If user is Admin or Manager, they can view unmasked NID for check-in verification
  const isAuthorizedManager = user.role === "ADMIN" || user.role === "MANAGER";

  return {
    ...guest,
    displayNid: isAuthorizedManager ? guest.nidPassport : maskNid(guest.nidPassport),
  };
}

export async function createGuestAction(hotelId: string, rawData: z.infer<typeof guestSchema>) {
  const manager = await requireManager(hotelId);
  const parsed = guestSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const data = parsed.data;

  try {
    const existing = await prisma.guest.findFirst({
      where: { hotelId, mobile: data.mobile.trim() },
    });
    if (existing) {
      return { success: false, error: `A guest with mobile ${data.mobile} is already registered.` };
    }

    const guest = await prisma.guest.create({
      data: {
        hotelId,
        fullName: data.fullName.trim(),
        mobile: data.mobile.trim(),
        email: data.email?.trim() || null,
        nidPassport: data.nidPassport?.trim() || null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        country: data.country,
        nationality: data.nationality,
        emergencyContact: data.emergencyContact?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    await logAuditEvent({
      actorId: manager.userId,
      hotelId,
      action: "GUEST_CREATED",
      entityType: "GUEST",
      entityId: guest.id,
      metadata: { fullName: guest.fullName, mobile: guest.mobile },
    });

    revalidatePath("/dashboard/guests");
    return { success: true, guest };
  } catch (err) {
    console.error("Failed to create guest:", err);
    return { success: false, error: "Database error while adding guest profile." };
  }
}
