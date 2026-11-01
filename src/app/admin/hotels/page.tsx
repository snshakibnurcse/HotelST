import * as React from "react";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/tenant";
import { HotelsManagementView } from "@/components/admin/HotelsManagementView";

export default async function AdminHotelsPage() {
  await requireAdmin();

  const hotels = await prisma.hotel.findMany({
    include: {
      _count: {
        select: {
          rooms: { where: { isArchived: false } },
          reservations: true,
          guests: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <HotelsManagementView
      hotels={hotels.map((h) => ({
        ...h,
        taxRate: Number(h.taxRate),
      }))}
    />
  );
}
