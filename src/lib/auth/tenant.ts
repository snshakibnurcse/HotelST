import { getSession, SessionPayload } from "@/lib/auth/session";
import prisma from "@/lib/prisma";

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Access denied: insufficient permissions or unauthorized hotel") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Returns the currently authenticated user session or throws UnauthorizedError
 */
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || !session.userId) {
    throw new UnauthorizedError();
  }

  // Verify user still exists and is active in database
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, fullName: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Account deactivated or not found");
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

/**
 * Ensures the authenticated user is a System Administrator
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new ForbiddenError("Administrator privileges required");
  }
  return user;
}

/**
 * Strictly requires Manager or Administrator privileges for a given hotel.
 * Crucial: Investors are STRICTLY REJECTED from all mutation APIs.
 */
export async function requireManager(hotelId: string): Promise<SessionPayload> {
  const user = await requireUser();

  if (user.role === "ADMIN") {
    return user;
  }

  if (user.role === "INVESTOR") {
    throw new ForbiddenError("Investors have strictly read-only access and cannot perform modifications");
  }

  if (user.role === "MANAGER") {
    const assignment = await prisma.hotelUser.findUnique({
      where: {
        hotelId_userId: {
          hotelId,
          userId: user.userId,
        },
      },
    });

    if (!assignment) {
      throw new ForbiddenError("You are not assigned to manage this hotel");
    }

    return user;
  }

  throw new ForbiddenError("Unauthorized role");
}

/**
 * Checks read access to a hotel.
 * System Admins can read all hotels.
 * Managers can read their assigned hotels.
 * Investors can read hotels they are authorized to view (or all active hotels if no restrictions specified).
 */
export async function requireHotelReadAccess(hotelId: string): Promise<SessionPayload> {
  const user = await requireUser();

  if (user.role === "ADMIN") {
    return user;
  }

  if (user.role === "MANAGER") {
    const assignment = await prisma.hotelUser.findUnique({
      where: {
        hotelId_userId: {
          hotelId,
          userId: user.userId,
        },
      },
    });
    if (!assignment) {
      throw new ForbiddenError("You do not have access to this hotel's data");
    }
    return user;
  }

  if (user.role === "INVESTOR") {
    // Check if investor has explicit assignments; if none, investors have portfolio-level read access to all active hotels
    const explicitAssignmentsCount = await prisma.investorHotelAccess.count({
      where: { userId: user.userId },
    });

    if (explicitAssignmentsCount > 0) {
      const allowed = await prisma.investorHotelAccess.findUnique({
        where: {
          hotelId_userId: {
            hotelId,
            userId: user.userId,
          },
        },
      });
      if (!allowed) {
        throw new ForbiddenError("Investor is not authorized for this specific hotel");
      }
    }
    return user;
  }

  throw new ForbiddenError("Unauthorized role");
}

/**
 * Returns the list of hotels the user is authorized to access
 */
export async function getAuthorizedHotels(user: SessionPayload) {
  if (user.role === "ADMIN") {
    return prisma.hotel.findMany({
      orderBy: { name: "asc" },
    });
  }

  if (user.role === "MANAGER") {
    return prisma.hotel.findMany({
      where: {
        managers: {
          some: {
            userId: user.userId,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  if (user.role === "INVESTOR") {
    const explicitAssignments = await prisma.investorHotelAccess.findMany({
      where: { userId: user.userId },
      include: { hotel: true },
    });

    if (explicitAssignments.length > 0) {
      return explicitAssignments.map((a) => a.hotel);
    }

    // Default portfolio view: all active hotels
    return prisma.hotel.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  return [];
}
