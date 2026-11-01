import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getHotelDetailsAction } from "@/actions/hotels";
import { HotelSettingsView } from "@/components/settings/HotelSettingsView";
import { redirect } from "next/navigation";

interface SettingsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) return <div className="p-8">No hotel assigned.</div>;

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;
  const hotel = await getHotelDetailsAction(selectedHotelId);

  return (
    <HotelSettingsView
      hotel={{
        ...hotel,
        taxRate: Number(hotel.taxRate),
      }}
    />
  );
}
