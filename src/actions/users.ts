"use server";

import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/tenant";
import { hashPassword } from "@/lib/auth/password";
import { logAuditEvent } from "@/lib/audit";
import { Role } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const createUserSchema = z.object({
  email: z.string().email("Valid email required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "INVESTOR"]),
  assignedHotelId: z.string().optional(),
});

export async function getUsersAction() {
  await requireAdmin();
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      hotelAssignments: {
        include: { hotel: { select: { id: true, name: true, code: true } } },
      },
      investorAccess: {
        include: { hotel: { select: { id: true, name: true, code: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUserAction(rawData: z.infer<typeof createUserSchema>) {
  const admin = await requireAdmin();
  const parsed = createUserSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Validation failed" };
  }

  const { email, fullName, password, phone, role, assignedHotelId } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return { success: false, error: "A user with this email address already exists." };
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        fullName,
        passwordHash,
        phone: phone || null,
        role: role as Role,
        isActive: true,
      },
    });

    // If a manager or investor and assignedHotelId was specified, assign them
    if (assignedHotelId) {
      if (role === "MANAGER") {
        await prisma.hotelUser.create({
          data: { hotelId: assignedHotelId, userId: user.id },
        });
      } else if (role === "INVESTOR") {
        await prisma.investorHotelAccess.create({
          data: { hotelId: assignedHotelId, userId: user.id },
        });
      }
    }

    await logAuditEvent({
      actorId: admin.userId,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: user.id,
      metadata: { role: user.role, email: user.email },
    });

    revalidatePath("/admin");
    return { success: true, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } };
  } catch (err: unknown) {
    console.error("Failed to create user:", err);
    return { success: false, error: "Database error while creating user." };
  }
}

export async function assignHotelAccessAction({
  userId,
  hotelId,
  type,
}: {
  userId: string;
  hotelId: string;
  type: "MANAGER" | "INVESTOR";
}) {
  const admin = await requireAdmin();

  try {
    if (type === "MANAGER") {
      await prisma.hotelUser.upsert({
        where: { hotelId_userId: { hotelId, userId } },
        update: {},
        create: { hotelId, userId, role: "MANAGER" },
      });
    } else {
      await prisma.investorHotelAccess.upsert({
        where: { hotelId_userId: { hotelId, userId } },
        update: {},
        create: { hotelId, userId },
      });
    }

    await logAuditEvent({
      actorId: admin.userId,
      hotelId,
      action: `ASSIGN_${type}`,
      entityType: "USER",
      entityId: userId,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Failed to assign access:", err);
    return { success: false, error: "Failed to assign hotel access" };
  }
}

export async function removeHotelAccessAction({
  userId,
  hotelId,
  type,
}: {
  userId: string;
  hotelId: string;
  type: "MANAGER" | "INVESTOR";
}) {
  const admin = await requireAdmin();

  try {
    if (type === "MANAGER") {
      await prisma.hotelUser.deleteMany({
        where: { hotelId, userId },
      });
    } else {
      await prisma.investorHotelAccess.deleteMany({
        where: { hotelId, userId },
      });
    }

    await logAuditEvent({
      actorId: admin.userId,
      hotelId,
      action: `REVOKE_${type}`,
      entityType: "USER",
      entityId: userId,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("Failed to revoke access:", err);
    return { success: false, error: "Failed to revoke hotel access" };
  }
}

export async function resetPasswordAction(userId: string, newPlainPassword: string) {
  const admin = await requireAdmin();

  if (!newPlainPassword || newPlainPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters long." };
  }

  try {
    const passwordHash = await hashPassword(newPlainPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await logAuditEvent({
      actorId: admin.userId,
      action: "PASSWORD_RESET_ADMIN",
      entityType: "USER",
      entityId: userId,
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to reset password:", err);
    return { success: false, error: "Failed to update password" };
  }
}

export async function toggleUserStatusAction(userId: string) {
  const admin = await requireAdmin();

  if (userId === admin.userId) {
    return { success: false, error: "You cannot deactivate your own administrative account." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found" };

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  await logAuditEvent({
    actorId: admin.userId,
    action: updated.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    entityType: "USER",
    entityId: userId,
  });

  revalidatePath("/admin");
  return { success: true, isActive: updated.isActive };
}
