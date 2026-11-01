import * as React from "react";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/tenant";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Building2, Users, BedDouble, Shield, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [hotelCount, activeHotelCount, roomCount, userCount, auditLogs] = await Promise.all([
    prisma.hotel.count(),
    prisma.hotel.count({ where: { isActive: true } }),
    prisma.room.count({ where: { isArchived: false } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.auditLog.findMany({
      include: {
        actor: { select: { fullName: true, role: true } },
        hotel: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          System Administration Overview
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Enterprise portfolio management, tenant isolation oversight, and security audit logs.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-[#0F2744]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Hotels</span>
              <Building2 className="w-4 h-4 text-[#0F2744]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{activeHotelCount}</span>
              <span className="text-xs text-slate-500">/ {hotelCount} Total</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">System Room Inventory</span>
              <BedDouble className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-slate-900">{roomCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#C59B27]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active User Accounts</span>
              <Users className="w-4 h-4 text-[#C59B27]" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-slate-900">{userCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Database Engine</span>
              <Shield className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2">
              <span className="text-sm font-bold text-slate-900">MySQL / MariaDB</span>
              <span className="block text-[11px] text-emerald-600 font-semibold mt-0.5">sthotel connected</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">Recent Security & Operations Audit Logs</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">Chronological record of mutations and access events</p>
          </div>
          <Link
            href="/admin/audit"
            className="text-xs font-semibold text-[#0F2744] hover:underline"
          >
            View Full Audit Log →
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-semibold">Timestamp</th>
                  <th className="pb-2 font-semibold">Action</th>
                  <th className="pb-2 font-semibold">Actor</th>
                  <th className="pb-2 font-semibold">Hotel Scope</th>
                  <th className="pb-2 font-semibold">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 text-slate-500">{formatDate(log.createdAt)}</td>
                    <td className="py-2.5 font-bold text-slate-800 font-mono text-[11px]">{log.action}</td>
                    <td className="py-2.5 text-slate-700">
                      {log.actor ? `${log.actor.fullName} (${log.actor.role})` : "System / Anonymous"}
                    </td>
                    <td className="py-2.5 font-medium text-slate-700">{log.hotel ? log.hotel.name : "System Global"}</td>
                    <td className="py-2.5 font-medium text-slate-600">{log.entityType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
