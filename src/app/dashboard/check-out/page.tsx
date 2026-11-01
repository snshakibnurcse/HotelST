import * as React from "react";
import { getSession } from "@/lib/auth/session";
import { getAuthorizedHotels } from "@/lib/auth/tenant";
import { getReservationsAction } from "@/actions/reservations";
import { getRoomsAction } from "@/actions/rooms";
import { CheckOutWorkflowView } from "@/components/operations/CheckOutWorkflowView";
import { redirect } from "next/navigation";

interface CheckOutPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CheckOutPage({ searchParams }: CheckOutPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const authorizedHotels = await getAuthorizedHotels(session);
  if (authorizedHotels.length === 0) return <div className="p-8">No hotel assigned.</div>;

  const selectedHotelId = (sp?.hotelId as string) || authorizedHotels[0]?.id;

  // Fetch guests currently CHECKED_IN and all rooms for room move extension
  const [{ items }, rooms] = await Promise.all([
    getReservationsAction(selectedHotelId, {
      status: "CHECKED_IN",
      limit: 50,
    }),
    getRoomsAction(selectedHotelId, { includeArchived: false }),
  ]);

  return (
    <CheckOutWorkflowView
      hotelId={selectedHotelId}
      occupiedReservations={items.map((r) => ({
        id: r.id,
        reservationNumber: r.reservationNumber,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        totalNights: r.totalNights,
        nightlyRateSnapshot: Number(r.nightlyRateSnapshot),
        totalAmount: Number(r.totalAmount),
        paidAmount: Number(r.paidAmount),
        outstandingBalance: Number(r.outstandingBalance),
        guest: r.guest,
        room: { id: r.room.id, roomNumber: r.room.roomNumber, type: r.room.roomType.name },
        invoices: r.invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
        })),
      }))}
      rooms={rooms.map((rm) => ({
        id: rm.id,
        roomNumber: rm.roomNumber,
        type: rm.roomType.name,
        basePrice: Number(rm.roomType.basePrice),
        status: rm.status,
      }))}
    />
  );
}
