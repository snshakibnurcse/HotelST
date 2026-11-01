import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getRoomsAction, getRoomTypesAction } from "@/actions/rooms";
import { RoomsManagementView } from "@/components/rooms/RoomsManagementView";
import { redirect } from "next/navigation";

interface RoomsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) {
    return <div className="p-8 text-center">No authorized hotel found.</div>;
  }

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;

  const [rooms, roomTypes] = await Promise.all([
    getRoomsAction(selectedHotelId),
    getRoomTypesAction(selectedHotelId),
  ]);

  return (
    <RoomsManagementView
      hotelId={selectedHotelId}
      rooms={rooms.map((r) => ({
        ...r,
        roomType: {
          ...r.roomType,
          basePrice: Number(r.roomType.basePrice),
        },
      }))}
      roomTypes={roomTypes.map((rt) => ({
        ...rt,
        basePrice: Number(rt.basePrice),
      }))}
    />
  );
}
