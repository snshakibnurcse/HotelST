import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getGuestsAction } from "@/actions/guests";
import { GuestsDirectoryView } from "@/components/guests/GuestsDirectoryView";
import { redirect } from "next/navigation";

interface GuestsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GuestsPage({ searchParams }: GuestsPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) return <div className="p-8">No hotel assigned.</div>;

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;
  const search = sp?.search as string | undefined;

  const guests = await getGuestsAction(selectedHotelId, search);

  return (
    <GuestsDirectoryView
      hotelId={selectedHotelId}
      guests={guests}
      isReadOnly={false}
    />
  );
}
