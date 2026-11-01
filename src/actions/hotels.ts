"use server";

import prisma from "@/lib/prisma";
import { requireAdmin, requireHotelReadAccess, requireUser, getAuthorizedHotels } from "@/lib/auth/tenant";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const hotelSchema = z.object({
  name: z.string().min(2, "Hotel name must be at least 2 characters"),
  code: z.string().min(2, "Hotel code must be at least 2 characters").max(10),
  address: z.string().min(3, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(),
  country: z.string().default("Bangladesh"),
  postalCode: z.string().optional(),
  phone: z.string().min(6, "Valid phone number required"),
  email: z.string().email("Valid email required"),
  website: z.string().optional(),
  starRating: z.number().int().min(1).max(5).default(3),
  checkInTime: z.string().default("14:00"),
  checkOutTime: z.string().default("12:00"),
  currency: z.string().default("BDT"),
  taxRate: z.number().min(0).max(100).default(0),
});

export async function getAuthorizedHotelsAction() {
  const user = await requireUser();
  return getAuthorizedHotels(user);
}

export async function getHotelDetailsAction(hotelId: string) {
  await requireHotelReadAccess(hotelId);
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    include: {
      managers: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      },
      _count: {
        select: {
          rooms: { where: { isArchived: false } },
          reservations: true,
          guests: true,
        },
      },
    },
  });

  if (!hotel) {
    throw new Error("Hotel not found");
  }

  return hotel;
}

export async function createHotelAction(rawData: z.infer<typeof hotelSchema>) {
  const user = await requireAdmin();
  const parsed = hotelSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const data = parsed.data;
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  try {
    const existingCode = await prisma.hotel.findUnique({ where: { code: data.code.toUpperCase() } });
    if (existingCode) {
      return { success: false, error: `Hotel code '${data.code}' is already in use.` };
    }

    const hotel = await prisma.hotel.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        slug: `${slug}-${Math.floor(100 + Math.random() * 900)}`,
        address: data.address,
        city: data.city,
        state: data.state || null,
        country: data.country,
        postalCode: data.postalCode || null,
        phone: data.phone,
        email: data.email,
        website: data.website || null,
        starRating: data.starRating,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        currency: data.currency,
        taxRate: data.taxRate,
      },
    });

    // Automatically seed basic financial categories for this new hotel
    const defaultIncome = ["Room Revenue", "Extra Guest Charges", "Food & Beverage", "Laundry Service", "Other Hotel Income"];
    const defaultExpense = ["Salaries & Wages", "Electricity Bill", "Water & Utility", "Internet & Software", "Maintenance & Repairs", "Housekeeping Supplies", "Food Supplies", "Rent", "Marketing", "Other Operating Expenses"];

    await prisma.$transaction([
      ...defaultIncome.map((name) =>
        prisma.financialCategory.create({
          data: { hotelId: hotel.id, name, type: "INCOME", isSystem: name === "Room Revenue" },
        })
      ),
      ...defaultExpense.map((name) =>
        prisma.financialCategory.create({
          data: { hotelId: hotel.id, name, type: "EXPENSE", isSystem: false },
        })
      ),
    ]);

    await logAuditEvent({
      actorId: user.userId,
      hotelId: hotel.id,
      action: "HOTEL_CREATED",
      entityType: "HOTEL",
      entityId: hotel.id,
      metadata: { hotelName: hotel.name, hotelCode: hotel.code },
    });

    revalidatePath("/admin");
    return { success: true, hotel };
  } catch (err: unknown) {
    console.error("Failed to create hotel:", err);
    return { success: false, error: "Database error while creating hotel." };
  }
}

export async function updateHotelAction(hotelId: string, rawData: Partial<z.infer<typeof hotelSchema>>) {
  const user = await requireAdmin();

  try {
    const hotel = await prisma.hotel.update({
      where: { id: hotelId },
      data: {
        ...(rawData.name ? { name: rawData.name } : {}),
        ...(rawData.address ? { address: rawData.address } : {}),
        ...(rawData.city ? { city: rawData.city } : {}),
        ...(rawData.state !== undefined ? { state: rawData.state } : {}),
        ...(rawData.country ? { country: rawData.country } : {}),
        ...(rawData.phone ? { phone: rawData.phone } : {}),
        ...(rawData.email ? { email: rawData.email } : {}),
        ...(rawData.website !== undefined ? { website: rawData.website } : {}),
        ...(rawData.starRating ? { starRating: rawData.starRating } : {}),
        ...(rawData.checkInTime ? { checkInTime: rawData.checkInTime } : {}),
        ...(rawData.checkOutTime ? { checkOutTime: rawData.checkOutTime } : {}),
        ...(rawData.currency ? { currency: rawData.currency } : {}),
        ...(rawData.taxRate !== undefined ? { taxRate: rawData.taxRate } : {}),
      },
    });

    await logAuditEvent({
      actorId: user.userId,
      hotelId: hotel.id,
      action: "HOTEL_UPDATED",
      entityType: "HOTEL",
      entityId: hotel.id,
      metadata: { changes: Object.keys(rawData) },
    });

    revalidatePath("/admin");
    return { success: true, hotel };
  } catch (err: unknown) {
    console.error("Failed to update hotel:", err);
    return { success: false, error: "Failed to update hotel profile." };
  }
}

export async function toggleHotelStatusAction(hotelId: string) {
  const user = await requireAdmin();

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) return { success: false, error: "Hotel not found" };

  const updated = await prisma.hotel.update({
    where: { id: hotelId },
    data: { isActive: !hotel.isActive },
  });

  await logAuditEvent({
    actorId: user.userId,
    hotelId: hotel.id,
    action: updated.isActive ? "HOTEL_ACTIVATED" : "HOTEL_DEACTIVATED",
    entityType: "HOTEL",
    entityId: hotel.id,
  });

  revalidatePath("/admin");
  return { success: true, isActive: updated.isActive };
}
