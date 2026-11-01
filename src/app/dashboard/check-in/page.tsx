import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getReservationsAction } from "@/actions/reservations";
import { CheckInWorkflowView } from "@/components/operations/CheckInWorkflowView";
import { redirect } from "next/navigation";

interface CheckInPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CheckInPage({ searchParams }: CheckInPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) return <div className="p-8">No hotel assigned.</div>;

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;

  // Fetch pending / confirmed reservations eligible for check-in
  const { items } = await getReservationsAction(selectedHotelId, {
    status: "CONFIRMED",
    limit: 50,
  });

  return (
    <CheckInWorkflowView
      hotelId={selectedHotelId}
      eligibleReservations={items.map((r) => ({
        id: r.id,
        reservationNumber: r.reservationNumber,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        totalNights: r.totalNights,
        totalAmount: Number(r.totalAmount),
        paidAmount: Number(r.paidAmount),
        outstandingBalance: Number(r.outstandingBalance),
        guest: r.guest,
        room: { roomNumber: r.room.roomNumber, type: r.room.roomType.name },
      }))}
    />
  );
}
