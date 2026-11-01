import prisma from "@/lib/prisma";

export interface LogAuditParams {
  actorId?: string | null;
  hotelId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    let sanitizedMetadata: string | null = null;
    if (params.metadata) {
      // Deep copy and sanitize sensitive keys
      const safe = { ...params.metadata };
      const sensitiveKeys = ["password", "passwordHash", "nidPassport", "secret", "token"];
      for (const key of Object.keys(safe)) {
        if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
          safe[key] = "[REDACTED]";
        }
      }
      sanitizedMetadata = JSON.stringify(safe);
    }

    await prisma.auditLog.create({
      data: {
        actorId: params.actorId || null,
        hotelId: params.hotelId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        metadata: sanitizedMetadata,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
