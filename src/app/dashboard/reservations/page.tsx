import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getReservationsAction } from "@/actions/reservations";
import { getRoomsAction } from "@/actions/rooms";
import { ReservationsListView } from "@/components/reservations/ReservationsListView";
import { ReservationStatus } from "@prisma/client";
import { redirect } from "next/navigation";

interface ReservationsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReservationsPage({ searchParams }: ReservationsPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) {
    return <div className="p-8 text-center">No authorized hotel found.</div>;
  }

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;
  const statusFilter = sp?.status && sp.status !== "ALL" ? (sp.status as ReservationStatus) : undefined;
  const search = sp?.search as string | undefined;
  const initialRoomId = sp?.createForRoom as string | undefined;

  const [resData, rooms] = await Promise.all([
    getReservationsAction(selectedHotelId, {
      status: statusFilter,
      search,
    }),
    getRoomsAction(selectedHotelId, { includeArchived: false }),
  ]);

  return (
    <ReservationsListView
      hotelId={selectedHotelId}
      reservations={resData.items.map((r) => ({
        ...r,
        nightlyRateSnapshot: Number(r.nightlyRateSnapshot),
        totalAmount: Number(r.totalAmount),
        paidAmount: Number(r.paidAmount),
        outstandingBalance: Number(r.outstandingBalance),
      }))}
      rooms={rooms.map((rm) => ({
        id: rm.id,
        roomNumber: rm.roomNumber,
        roomType: {
          name: rm.roomType.name,
          basePrice: Number(rm.roomType.basePrice),
        },
      }))}
      pagination={resData.pagination}
      initialRoomId={initialRoomId}
      isReadOnly={false}
    />
  );
}
