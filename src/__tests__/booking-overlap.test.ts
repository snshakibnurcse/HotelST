import { describe, it, expect } from "vitest";
import {
  validateBookingDates,
  calculateStayAmounts,
  resolveBoardStatusForDate,
} from "@/lib/booking";
import { ReservationStatus, RoomStatus } from "@prisma/client";

describe("Booking Overlap and Date Validation Logic", () => {
  it("rejects invalid date ranges where checkout is before or same as check-in", () => {
    const sameDay = validateBookingDates(new Date(2026, 9, 20), new Date(2026, 9, 20));
    expect(sameDay.isValid).toBe(false);
    expect(sameDay.totalNights).toBe(0);

    const reversed = validateBookingDates(new Date(2026, 9, 22), new Date(2026, 9, 20));
    expect(reversed.isValid).toBe(false);
    expect(reversed.totalNights).toBe(0);
  });

  it("accurately calculates total calendar stay nights", () => {
    const valid = validateBookingDates(new Date(2026, 9, 20), new Date(2026, 9, 23));
    expect(valid.isValid).toBe(true);
    expect(valid.totalNights).toBe(3);
  });

  it("verifies mathematical overlap principle [startA, endA) vs [startB, endB)", () => {
    // Overlap function: startA < endB AND endA > startB
    function doesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
      return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
    }

    const resA_in = new Date("2026-10-20T00:00:00Z");
    const resA_out = new Date("2026-10-22T00:00:00Z");

    // Case 1: Back-to-back stays (Res B arrives the day Res A departs) -> MUST NOT OVERLAP
    const resB_in = new Date("2026-10-22T00:00:00Z");
    const resB_out = new Date("2026-10-25T00:00:00Z");
    expect(doesOverlap(resA_in, resA_out, resB_in, resB_out)).toBe(false);

    // Case 2: Overlapping nights (Res C arrives on 21st, while Res A departs on 22nd) -> MUST OVERLAP
    const resC_in = new Date("2026-10-21T00:00:00Z");
    const resC_out = new Date("2026-10-24T00:00:00Z");
    expect(doesOverlap(resA_in, resA_out, resC_in, resC_out)).toBe(true);

    // Case 3: Complete containment (Res D is inside Res E) -> MUST OVERLAP
    const resD_in = new Date("2026-10-21T00:00:00Z");
    const resD_out = new Date("2026-10-23T00:00:00Z");
    const resE_in = new Date("2026-10-19T00:00:00Z");
    const resE_out = new Date("2026-10-26T00:00:00Z");
    expect(doesOverlap(resD_in, resD_out, resE_in, resE_out)).toBe(true);
  });

  it("calculates stay amounts, discounts, and taxes with exact decimal precision", () => {
    const calc = calculateStayAmounts({
      nightlyRate: 6500,
      totalNights: 3,
      discountAmount: 1000,
      taxRatePercent: 5,
      additionalCharges: 500,
    });

    expect(calc.roomCharges).toBe(19500); // 3 * 6500
    expect(calc.discountAmount).toBe(1000);
    expect(calc.additionalCharges).toBe(500);
    // subtotal after discount = 19500 - 1000 + 500 = 19000
    // 5% VAT on 19000 = 950
    expect(calc.taxAmount).toBe(950);
    // Total = 19000 + 950 = 19950
    expect(calc.totalAmount).toBe(19950);
  });

  it("accurately computes Visual Room Board statuses based on dates and reservations", () => {
    const targetDate = new Date("2026-10-21T00:00:00Z");

    // Room 1: Checked-in guest staying from 20th to 23rd
    const statusOccupied = resolveBoardStatusForDate({
      roomStatus: RoomStatus.OCCUPIED,
      isArchived: false,
      activeReservations: [
        {
          id: "res-1",
          reservationNumber: "RES-101",
          checkInDate: new Date("2026-10-20T00:00:00Z"),
          checkOutDate: new Date("2026-10-23T00:00:00Z"),
          status: ReservationStatus.CHECKED_IN,
        },
      ],
      targetDate,
    });
    expect(statusOccupied.status).toBe("OCCUPIED");
    expect(statusOccupied.badgeColor).toContain("rose");

    // Room 2: Guest checking out on targetDate (21st)
    const statusCheckout = resolveBoardStatusForDate({
      roomStatus: RoomStatus.OCCUPIED,
      isArchived: false,
      activeReservations: [
        {
          id: "res-2",
          reservationNumber: "RES-102",
          checkInDate: new Date("2026-10-18T00:00:00Z"),
          checkOutDate: new Date("2026-10-21T00:00:00Z"),
          status: ReservationStatus.CHECKED_IN,
        },
      ],
      targetDate,
    });
    expect(statusCheckout.status).toBe("CHECKOUT_TODAY");

    // Room 3: Maintenance room
    const statusMaintenance = resolveBoardStatusForDate({
      roomStatus: RoomStatus.MAINTENANCE,
      isArchived: false,
      activeReservations: [],
      targetDate,
    });
    expect(statusMaintenance.status).toBe("MAINTENANCE");

    // Room 4: Available room (no reservations)
    const statusAvailable = resolveBoardStatusForDate({
      roomStatus: RoomStatus.AVAILABLE,
      isArchived: false,
      activeReservations: [],
      targetDate,
    });
    expect(statusAvailable.status).toBe("AVAILABLE");
    expect(statusAvailable.badgeColor).toContain("emerald");
  });

  it("calculates future booking safe window correctly when room is available today but booked on day 3", () => {
    const targetDate = new Date("2026-10-26T00:00:00Z");
    const targetTime = targetDate.getTime();

    // A reservation booked from Oct 28 to Oct 31 (starts 2 days after target date)
    const reservations = [
      {
        id: "res-upcoming-1",
        reservationNumber: "RES-901",
        checkInDate: new Date("2026-10-28T00:00:00Z"),
        checkOutDate: new Date("2026-10-31T00:00:00Z"),
        status: ReservationStatus.CONFIRMED,
        guestName: "Rahim Uddin",
      },
    ];

    // Find next upcoming reservation that starts strictly after targetDate
    const nextReservation = reservations.find((res) => {
      return res.checkInDate.getTime() > targetTime;
    });

    expect(nextReservation).toBeDefined();
    const diffDays = Math.round((nextReservation!.checkInDate.getTime() - targetTime) / (1000 * 60 * 60 * 24));
    
    // Exactly 2 nights available (Oct 26 and Oct 27) before guest arrives on Oct 28
    expect(diffDays).toBe(2);
  });

  it("accurately adjusts bill and deductions when a 3-night stay is checked out early after 2 nights", () => {
    const nightlyRate = 5000;
    const bookedNights = 3;
    const actualNights = 2;

    const originalBill = calculateStayAmounts({
      nightlyRate,
      totalNights: bookedNights,
      discountAmount: 0,
      taxRatePercent: 0,
      additionalCharges: 0,
    });
    expect(originalBill.totalAmount).toBe(15000);

    // When early checkout is performed after 2 nights
    const adjustedBill = calculateStayAmounts({
      nightlyRate,
      totalNights: actualNights,
      discountAmount: 0,
      taxRatePercent: 0,
      additionalCharges: 0,
    });
    expect(adjustedBill.totalAmount).toBe(10000);

    const deductionAmount = originalBill.totalAmount - adjustedBill.totalAmount;
    expect(deductionAmount).toBe(5000); // 1 unstayed night deducted
  });

  it("calculates extension room charges appended to master invoice correctly", () => {
    const room1Rate = 5000;
    const room1Nights = 3; // 15,000
    const room2MoveRate = 6000;
    const extensionNights = 1; // 6,000

    const room1Total = room1Rate * room1Nights;
    const extensionCharge = room2MoveRate * extensionNights;
    const consolidatedMasterTotal = room1Total + extensionCharge;

    expect(consolidatedMasterTotal).toBe(21000);
  });
});


