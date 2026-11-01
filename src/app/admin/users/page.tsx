import * as React from "react";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/tenant";
import { getUsersAction } from "@/actions/users";
import { UsersManagementView } from "@/components/admin/UsersManagementView";

export default async function AdminUsersPage() {
  await requireAdmin();

  const [users, hotels] = await Promise.all([
    getUsersAction(),
    prisma.hotel.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <UsersManagementView users={users} hotels={hotels} />;
}
