import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

const COOKIE_NAME = "hms_session";
const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback_default_secret_for_local_dev_only_change_in_production_32chars"
);

export interface SessionPayload {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SECRET_KEY);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
