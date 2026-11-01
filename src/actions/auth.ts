"use server";

import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, clearSession, getSession } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function loginAction(formData: FormData | { email: string; password: string }) {
  let email = "";
  let password = "";

  if (formData instanceof FormData) {
    email = (formData.get("email") as string) || "";
    password = (formData.get("password") as string) || "";
  } else {
    email = formData.email;
    password = formData.password;
  }

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
    });

    if (!user) {
      await logAuditEvent({
        action: "AUTH_LOGIN_FAILED",
        entityType: "USER",
        metadata: { email: parsed.data.email, reason: "User not found" },
      });
      return { success: false, error: "Invalid email or password" };
    }

    if (!user.isActive) {
      await logAuditEvent({
        actorId: user.id,
        action: "AUTH_LOGIN_BLOCKED",
        entityType: "USER",
        entityId: user.id,
        metadata: { reason: "Account inactive" },
      });
      return { success: false, error: "Your account has been deactivated. Please contact the administrator." };
    }

    const isValid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!isValid) {
      await logAuditEvent({
        actorId: user.id,
        action: "AUTH_LOGIN_FAILED",
        entityType: "USER",
        entityId: user.id,
        metadata: { reason: "Invalid password" },
      });
      return { success: false, error: "Invalid email or password" };
    }

    // Create session
    await createSession({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });

    await logAuditEvent({
      actorId: user.id,
      action: "AUTH_LOGIN_SUCCESS",
      entityType: "USER",
      entityId: user.id,
    });

    let redirectUrl = "/dashboard";
    if (user.role === "ADMIN") {
      redirectUrl = "/admin";
    } else if (user.role === "INVESTOR") {
      redirectUrl = "/investor";
    }

    return {
      success: true,
      role: user.role,
      redirectUrl,
    };
  } catch (err: unknown) {
    console.error("Login action error:", err);
    return { success: false, error: "A server error occurred during authentication." };
  }
}

export async function logoutAction() {
  const session = await getSession();
  if (session?.userId) {
    await logAuditEvent({
      actorId: session.userId,
      action: "AUTH_LOGOUT",
      entityType: "USER",
      entityId: session.userId,
    });
  }
  await clearSession();
  redirect("/login");
}

export async function getCurrentUserAction() {
  try {
    const session = await getSession();
    if (!session?.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        isActive: true,
      },
    });

    return user;
  } catch {
    return null;
  }
}
