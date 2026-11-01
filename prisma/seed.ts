import { PrismaClient, Role, RoomStatus, ReservationStatus, InvoiceStatus, PaymentMethod, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding for Grand Horizon HMS...");

  // 1. Create or ensure System Administrator
  const adminEmail = process.env.ADMIN_EMAIL || "admin@sthotel.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminHash,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email: adminEmail,
      fullName: "System Super Administrator",
      passwordHash: adminHash,
      role: Role.ADMIN,
      phone: "+8801700000001",
      isActive: true,
    },
  });
  console.log(`✓ Admin user created/updated: ${admin.email}`);

  // 2. Create Hotel Manager
  const managerHash = await bcrypt.hash("Manager@123456", 12);
  const manager = await prisma.user.upsert({
    where: { email: "manager@sthotel.com" },
    update: { passwordHash: managerHash, role: Role.MANAGER },
    create: {
      email: "manager@sthotel.com",
      fullName: "Kamal Hossain",
      passwordHash: managerHash,
      role: Role.MANAGER,
      phone: "+8801700000002",
      isActive: true,
    },
  });
  console.log(`✓ Hotel Manager created: ${manager.email}`);

  // 3. Create Investor
  const investorHash = await bcrypt.hash("Investor@123456", 12);
  const investor = await prisma.user.upsert({
    where: { email: "investor@sthotel.com" },
    update: { passwordHash: investorHash, role: Role.INVESTOR },
    create: {
      email: "investor@sthotel.com",
      fullName: "Tariqul Islam (Investor Partner)",
      passwordHash: investorHash,
      role: Role.INVESTOR,
      phone: "+8801700000003",
      isActive: true,
    },
  });
  console.log(`✓ Investor user created: ${investor.email}`);

  // 4. Create Hotel 1: Grand Palace Hotel (Dhaka)
  const hotel1 = await prisma.hotel.upsert({
    where: { code: "GPH" },
    update: {},
    create: {
      name: "The Grand Palace Hotel",
      slug: "grand-palace-dhaka",
      code: "GPH",
      address: "Road 11, Block D, Banani",
      city: "Dhaka",
      state: "Dhaka Division",
      country: "Bangladesh",
      postalCode: "1213",
      phone: "+88029876543",
      email: "info@grandpalacedhaka.com",
      website: "https://grandpalacedhaka.com",
      starRating: 5,
      checkInTime: "14:00",
      checkOutTime: "12:00",
      currency: "BDT",
      taxRate: 5.0, // 5% VAT
      isActive: true,
    },
  });
  console.log(`✓ Hotel 1 created: ${hotel1.name}`);

  // 5. Create Hotel 2: Azure Bay Beach Resort (Cox's Bazar)
  const hotel2 = await prisma.hotel.upsert({
    where: { code: "ABR" },
    update: {},
    create: {
      name: "Azure Bay Beach Resort",
      slug: "azure-bay-resort",
      code: "ABR",
      address: "Marine Drive, Kolatoli Beach",
      city: "Cox's Bazar",
      state: "Chittagong Division",
      country: "Bangladesh",
      postalCode: "4700",
      phone: "+88034165432",
      email: "contact@azurebayresort.com",
      website: "https://azurebayresort.com",
      starRating: 4,
      checkInTime: "14:00",
      checkOutTime: "11:30",
      currency: "BDT",
      taxRate: 7.5,
      isActive: true,
    },
  });
  console.log(`✓ Hotel 2 created: ${hotel2.name}`);

  // 6. Assign Manager to Hotel 1
  await prisma.hotelUser.upsert({
    where: {
      hotelId_userId: {
        hotelId: hotel1.id,
        userId: manager.id,
      },
    },
    update: {},
    create: {
      hotelId: hotel1.id,
      userId: manager.id,
      role: "GENERAL_MANAGER",
    },
  });

  // 7. Assign Investor access to both hotels
  await prisma.investorHotelAccess.upsert({
    where: {
      hotelId_userId: {
        hotelId: hotel1.id,
        userId: investor.id,
      },
    },
    update: {},
    create: {
      hotelId: hotel1.id,
      userId: investor.id,
    },
  });

  await prisma.investorHotelAccess.upsert({
    where: {
      hotelId_userId: {
        hotelId: hotel2.id,
        userId: investor.id,
      },
    },
    update: {},
    create: {
      hotelId: hotel2.id,
      userId: investor.id,
    },
  });

  // 8. Seed Financial Categories for Hotel 1 & 2
  const defaultIncomeCategories = [
    "Room Revenue",
    "Extra Guest Charges",
    "Food & Beverage",
    "Laundry Service",
    "Meeting Room & Banquet",
    "Other Hotel Income",
  ];

  const defaultExpenseCategories = [
    "Salaries & Wages",
    "Electricity Bill",
    "Water & Utility",
    "Internet & Software",
    "Maintenance & Equipment Repairs",
    "Housekeeping Supplies",
    "Food & Beverage Supplies",
    "Property Lease / Rent",
    "Marketing & Promotion",
    "Other Operating Expenses",
  ];

  for (const h of [hotel1, hotel2]) {
    for (const name of defaultIncomeCategories) {
      await prisma.financialCategory.upsert({
        where: {
          hotelId_name_type: {
            hotelId: h.id,
            name,
            type: TransactionType.INCOME,
          },
        },
        update: {},
        create: {
          hotelId: h.id,
          name,
          type: TransactionType.INCOME,
          isSystem: name === "Room Revenue",
        },
      });
    }

    for (const name of defaultExpenseCategories) {
      await prisma.financialCategory.upsert({
        where: {
          hotelId_name_type: {
            hotelId: h.id,
            name,
            type: TransactionType.EXPENSE,
          },
        },
        update: {},
        create: {
          hotelId: h.id,
          name,
          type: TransactionType.EXPENSE,
          isSystem: false,
        },
      });
    }
  }
  console.log("✓ Financial categories configured.");

  // 9. Seed Room Types for Hotel 1
  const deluxeType = await prisma.roomType.upsert({
    where: { hotelId_code: { hotelId: hotel1.id, code: "DLX" } },
    update: {},
    create: {
      hotelId: hotel1.id,
      name: "Deluxe King Room",
      code: "DLX",
      description: "Spacious luxury room with panoramic city skyline view, plush King bed, and work desk.",
      basePrice: 6500.0,
      maxAdults: 2,
      maxChildren: 1,
      totalBeds: 1,
      bedConfiguration: "1 King Bed",
      amenities: JSON.stringify(["High-Speed Wi-Fi", "43-inch 4K TV", "Mini Bar", "Air Conditioning", "Rain Shower", "Work Desk", "Coffee Maker"]),
    },
  });

  const execSuite = await prisma.roomType.upsert({
    where: { hotelId_code: { hotelId: hotel1.id, code: "EXE" } },
    update: {},
    create: {
      hotelId: hotel1.id,
      name: "Executive Grand Suite",
      code: "EXE",
      description: "Elegant master suite with separate living parlor, marble bathroom, and complimentary lounge access.",
      basePrice: 12000.0,
      maxAdults: 3,
      maxChildren: 2,
      totalBeds: 2,
      bedConfiguration: "1 King Bed + 1 Sofa Bed",
      amenities: JSON.stringify(["Living Room", "High-Speed Wi-Fi", "55-inch OLED TV", "Jacuzzi Bath", "Mini Bar", "Espresso Machine", "Lounge Access"]),
    },
  });

  const twinType = await prisma.roomType.upsert({
    where: { hotelId_code: { hotelId: hotel1.id, code: "TWN" } },
    update: {},
    create: {
      hotelId: hotel1.id,
      name: "Twin Standard Room",
      code: "TWN",
      description: "Comfortable twin room ideal for colleagues or friends traveling together.",
      basePrice: 5000.0,
      maxAdults: 2,
      maxChildren: 1,
      totalBeds: 2,
      bedConfiguration: "2 Single Beds",
      amenities: JSON.stringify(["Wi-Fi", "Smart TV", "Air Conditioning", "Hot Water Shower", "Work Desk"]),
    },
  });

  // Room Types for Hotel 2 (Azure Bay)
  const oceanView = await prisma.roomType.upsert({
    where: { hotelId_code: { hotelId: hotel2.id, code: "OCN" } },
    update: {},
    create: {
      hotelId: hotel2.id,
      name: "Ocean View Balcony Suite",
      code: "OCN",
      description: "Direct beachfront balcony view overlooking the Bay of Bengal.",
      basePrice: 8500.0,
      maxAdults: 2,
      maxChildren: 2,
      totalBeds: 1,
      bedConfiguration: "1 King Bed",
      amenities: JSON.stringify(["Sea View Balcony", "Wi-Fi", "Smart TV", "Mini Fridge", "Breakfast Included"]),
    },
  });

  // 10. Seed Rooms for Hotel 1
  const roomsHotel1Data = [
    { roomNumber: "101", floor: "1", typeId: deluxeType.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "102", floor: "1", typeId: deluxeType.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "103", floor: "1", typeId: twinType.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "104", floor: "1", typeId: twinType.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "201", floor: "2", typeId: deluxeType.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "202", floor: "2", typeId: deluxeType.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "203", floor: "2", typeId: execSuite.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "204", floor: "2", typeId: execSuite.id, status: RoomStatus.MAINTENANCE },
    { roomNumber: "301", floor: "3", typeId: execSuite.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "302", floor: "3", typeId: deluxeType.id, status: RoomStatus.AVAILABLE },
  ];

  for (const r of roomsHotel1Data) {
    await prisma.room.upsert({
      where: {
        hotelId_roomNumber: {
          hotelId: hotel1.id,
          roomNumber: r.roomNumber,
        },
      },
      update: {
        status: r.status,
        roomTypeId: r.typeId,
      },
      create: {
        hotelId: hotel1.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        roomTypeId: r.typeId,
        status: r.status,
        description: `Floor ${r.floor} room facing scenic views`,
      },
    });
  }

  // Rooms for Hotel 2
  const roomsHotel2Data = [
    { roomNumber: "A101", floor: "1", typeId: oceanView.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "A102", floor: "1", typeId: oceanView.id, status: RoomStatus.AVAILABLE },
    { roomNumber: "A201", floor: "2", typeId: oceanView.id, status: RoomStatus.AVAILABLE },
  ];

  for (const r of roomsHotel2Data) {
    await prisma.room.upsert({
      where: {
        hotelId_roomNumber: {
          hotelId: hotel2.id,
          roomNumber: r.roomNumber,
        },
      },
      update: {},
      create: {
        hotelId: hotel2.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        roomTypeId: r.typeId,
        status: r.status,
      },
    });
  }
  console.log("✓ Rooms created across hotels.");

  // 11. Seed Sample Guests
  const guest1 = await prisma.guest.create({
    data: {
      hotelId: hotel1.id,
      fullName: "Mahmudur Rahman",
      mobile: "+8801811223344",
      email: "mahmud.rahman@example.com",
      nidPassport: "5948392019",
      address: "House 45, Sector 4, Uttara",
      city: "Dhaka",
      nationality: "Bangladeshi",
    },
  });

  const guest2 = await prisma.guest.create({
    data: {
      hotelId: hotel1.id,
      fullName: "Nusrat Jahan",
      mobile: "+8801912345678",
      email: "nusrat.jahan@example.com",
      nidPassport: "7849302198",
      address: "Nasirabad Housing Society",
      city: "Chittagong",
      nationality: "Bangladeshi",
    },
  });

  // 12. Seed Reservations with full accounting (Room charges, discounts, taxes, invoices, payments)
  const room101 = await prisma.room.findUnique({
    where: { hotelId_roomNumber: { hotelId: hotel1.id, roomNumber: "101" } },
  });
  const room102 = await prisma.room.findUnique({
    where: { hotelId_roomNumber: { hotelId: hotel1.id, roomNumber: "102" } },
  });

  if (room101 && room102) {
    // Current active stay: Checked In
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 2);

    // Reservation 1: 3 nights (yesterday to tomorrow+1), Checked in, partial payment
    const res1 = await prisma.reservation.create({
      data: {
        reservationNumber: "RES-20261025-1001",
        hotelId: hotel1.id,
        roomId: room101.id,
        guestId: guest1.id,
        bookingSource: "WALK_IN",
        checkInDate: yesterday,
        checkOutDate: tomorrow,
        actualCheckIn: yesterday,
        status: ReservationStatus.CHECKED_IN,
        adultCount: 2,
        childCount: 0,
        nightlyRateSnapshot: 6500.0,
        totalNights: 3,
        roomCharges: 19500.0,
        discountAmount: 1000.0,
        additionalCharges: 500.0,
        taxAmount: 950.0, // 5% on 19000
        totalAmount: 19950.0,
        advancePaid: 10000.0,
        paidAmount: 10000.0,
        outstandingBalance: 9950.0,
        specialRequests: "Quiet room, extra bath towels requested.",
        createdById: manager.id,
      },
    });

    // Update room 101 to OCCUPIED
    await prisma.room.update({
      where: { id: room101.id },
      data: { status: RoomStatus.OCCUPIED },
    });

    // Generate Invoice for Reservation 1
    const inv1 = await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-20261025-1001",
        hotelId: hotel1.id,
        reservationId: res1.id,
        guestId: guest1.id,
        subtotal: 19500.0,
        discountAmount: 1000.0,
        additionalCharges: 500.0,
        taxAmount: 950.0,
        totalAmount: 19950.0,
        paidAmount: 10000.0,
        outstandingBalance: 9950.0,
        status: InvoiceStatus.PARTIALLY_PAID,
        createdById: manager.id,
        items: {
          create: [
            { description: "Deluxe King Room (3 Nights @ 6,500 BDT)", type: "ROOM_CHARGE", quantity: 3, unitPrice: 6500.0, totalPrice: 19500.0 },
            { description: "Airport Transfer Service", type: "SERVICE", quantity: 1, unitPrice: 500.0, totalPrice: 500.0 },
          ],
        },
      },
    });

    // Advance Payment for Invoice 1
    await prisma.payment.create({
      data: {
        paymentNumber: "PAY-20261025-1001",
        hotelId: hotel1.id,
        invoiceId: inv1.id,
        reservationId: res1.id,
        amount: 10000.0,
        method: PaymentMethod.BKASH,
        transactionRef: "TRX9483921",
        notes: "Advance payment via bKash Merchant",
        receivedById: manager.id,
      },
    });

    // Reservation 2: Future Confirmed Booking
    const nextWeekStart = new Date(today);
    nextWeekStart.setDate(today.getDate() + 5);
    const nextWeekEnd = new Date(today);
    nextWeekEnd.setDate(today.getDate() + 8);

    await prisma.reservation.create({
      data: {
        reservationNumber: "RES-20261025-1002",
        hotelId: hotel1.id,
        roomId: room102.id,
        guestId: guest2.id,
        bookingSource: "PHONE",
        checkInDate: nextWeekStart,
        checkOutDate: nextWeekEnd,
        status: ReservationStatus.CONFIRMED,
        adultCount: 1,
        childCount: 0,
        nightlyRateSnapshot: 6500.0,
        totalNights: 3,
        roomCharges: 19500.0,
        discountAmount: 0.0,
        additionalCharges: 0.0,
        taxAmount: 975.0,
        totalAmount: 20475.0,
        advancePaid: 5000.0,
        paidAmount: 5000.0,
        outstandingBalance: 15475.0,
        createdById: manager.id,
      },
    });
  }

  // 13. Seed Operational Expense Transactions
  const elecCat = await prisma.financialCategory.findFirst({
    where: { hotelId: hotel1.id, name: "Electricity Bill" },
  });
  const salaryCat = await prisma.financialCategory.findFirst({
    where: { hotelId: hotel1.id, name: "Salaries & Wages" },
  });
  const supplyCat = await prisma.financialCategory.findFirst({
    where: { hotelId: hotel1.id, name: "Housekeeping Supplies" },
  });

  if (elecCat) {
    await prisma.financialTransaction.create({
      data: {
        transactionNumber: "EXP-20261025-001",
        hotelId: hotel1.id,
        categoryId: elecCat.id,
        type: TransactionType.EXPENSE,
        amount: 32000.0,
        transactionDate: new Date(),
        description: "Monthly commercial electricity bill Banani DPDC",
        reference: "BILL-OCT-2026",
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        createdById: manager.id,
      },
    });
  }

  if (supplyCat) {
    await prisma.financialTransaction.create({
      data: {
        transactionNumber: "EXP-20261025-002",
        hotelId: hotel1.id,
        categoryId: supplyCat.id,
        type: TransactionType.EXPENSE,
        amount: 8500.0,
        transactionDate: new Date(),
        description: "Linens, toiletries, and cleaning detergents",
        reference: "VOUCHER-491",
        paymentMethod: PaymentMethod.CASH,
        createdById: manager.id,
      },
    });
  }

  // 14. Audit Log
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      hotelId: hotel1.id,
      action: "SYSTEM_INITIALIZED",
      entityType: "SYSTEM",
      entityId: hotel1.id,
      metadata: JSON.stringify({ message: "Initial seed completed with hotels, rooms, and test data" }),
    },
  });

  console.log("==================================================");
  console.log("Grand Horizon HMS Database Seeding Completed!");
  console.log("Credentials created:");
  console.log("Admin:    email: admin@sthotel.com    pass: Admin@123456");
  console.log("Manager:  email: manager@sthotel.com  pass: Manager@123456");
  console.log("Investor: email: investor@sthotel.com pass: Investor@123456");
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
