import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Investors belong in /investor
  if (session.role === "INVESTOR") {
    redirect("/investor");
  }

  const authorizedHotels = await getAuthorizedHotels(session);

  return (
    <AppShell
      currentUser={session}
      authorizedHotels={authorizedHotels.map((h) => ({
        id: h.id,
        name: h.name,
        code: h.code,
        city: h.city,
      }))}
      role={session.role}
    >
      {children}
    </AppShell>
  );
}
