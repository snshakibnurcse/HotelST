import * as React from "react";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/tenant";
import { formatDate } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Shield, Clock, User, Building2 } from "lucide-react";

export default async function AdminAuditLogsPage() {
  await requireAdmin();

  const logs = await prisma.auditLog.findMany({
    include: {
      actor: { select: { fullName: true, email: true, role: true } },
      hotel: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          System Security & Audit Trail
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable event log of user logins, booking creations, check-ins, payment collections, and financial adjustments.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Actor</th>
                  <th className="py-3 px-4 font-semibold">Hotel Scope</th>
                  <th className="py-3 px-4 font-semibold">Entity Type</th>
                  <th className="py-3 px-4 font-semibold">Entity ID</th>
                  <th className="py-3 px-4 font-semibold">Sanitized Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 text-[11px]">{log.action}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {log.actor ? (
                        <div>
                          <span className="font-semibold block">{log.actor.fullName}</span>
                          <span className="text-[10px] text-slate-400 block">{log.actor.role}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System Event</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {log.hotel ? `${log.hotel.name} (${log.hotel.code})` : "Global System"}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-600">{log.entityType}</td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400">{log.entityId || "—"}</td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                      {log.metadata || "—"}
                    </td>
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
