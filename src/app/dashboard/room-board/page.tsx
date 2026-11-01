import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getRoomBoardAction, getRoomTypesAction } from "@/actions/rooms";
import { RoomBoardView } from "@/components/rooms/RoomBoardView";
import { redirect } from "next/navigation";

interface RoomBoardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RoomBoardPage({ searchParams }: RoomBoardPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);

  if (authorizedHotels.length === 0) {
    return <div className="p-8 text-center">No authorized hotel found.</div>;
  }

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;
  const targetDateStr = (sp?.date as string) || new Date().toISOString().slice(0, 10);

  const [boardData, roomTypes] = await Promise.all([
    getRoomBoardAction(selectedHotelId, targetDateStr),
    getRoomTypesAction(selectedHotelId),
  ]);

  return (
    <RoomBoardView
      hotelId={selectedHotelId}
      boardData={boardData}
      roomTypes={roomTypes}
      isReadOnly={false}
    />
  );
}
