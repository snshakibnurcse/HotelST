import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  status: string;
  hotel: {
    name: string;
    code: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    currency: string;
  };
  guest: {
    fullName: string;
    mobile: string;
    email?: string | null;
    address?: string | null;
  };
  reservation?: {
    reservationNumber: string;
    checkInDate: Date | string;
    checkOutDate: Date | string;
    totalNights: number;
    roomNumber: string;
    roomType: string;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  discountAmount: number;
  additionalCharges: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingBalance: number;
  payments?: Array<{
    paymentNumber: string;
    amount: number;
    method: string;
    paymentDate: Date | string;
    transactionRef?: string | null;
  }>;
}

export function generateInvoicePdf(data: InvoicePdfData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const currency = data.hotel.currency || "BDT";

  // Header Luxury Navy Banner
  doc.setFillColor(15, 39, 68); // #0F2744
  doc.rect(0, 0, 210, 36, "F");

  // Hotel Name & Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.hotel.name.toUpperCase(), 14, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(212, 175, 55); // Warm gold
  doc.text(`HOTEL CODE: ${data.hotel.code} | LUXURY HOSPITALITY`, 14, 22);

  doc.setTextColor(200, 210, 225);
  doc.setFontSize(8);
  doc.text(`${data.hotel.address}, ${data.hotel.city} | Tel: ${data.hotel.phone} | Email: ${data.hotel.email}`, 14, 28);

  // INVOICE Header on top right
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("GUEST INVOICE", 196, 16, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(212, 175, 55);
  doc.text(`# ${data.invoiceNumber}`, 196, 23, { align: "right" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Status: ${data.status.replace("_", " ")}`, 196, 29, { align: "right" });

  // Bill To & Stay Summary Section
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("GUEST BILLING INFORMATION", 14, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Name: ${data.guest.fullName}`, 14, 52);
  doc.text(`Contact: ${data.guest.mobile}`, 14, 57);
  if (data.guest.email) doc.text(`Email: ${data.guest.email}`, 14, 62);
  if (data.guest.address) doc.text(`Address: ${data.guest.address}`, 14, 67);

  // Right column: Stay Details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("STAY RESERVATION DETAILS", 120, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  if (data.reservation) {
    doc.text(`Reservation No: ${data.reservation.reservationNumber}`, 120, 52);
    doc.text(`Room: #${data.reservation.roomNumber} (${data.reservation.roomType})`, 120, 57);
    doc.text(`Check-In:  ${formatDate(data.reservation.checkInDate)}`, 120, 62);
    doc.text(`Check-Out: ${formatDate(data.reservation.checkOutDate)} (${data.reservation.totalNights} Nights)`, 120, 67);
  } else {
    doc.text(`Date of Issue: ${formatDate(data.issueDate)}`, 120, 52);
    if (data.dueDate) doc.text(`Due Date: ${formatDate(data.dueDate)}`, 120, 57);
  }

  // Items Table
  const tableRows = data.items.map((item, idx) => [
    idx + 1,
    item.description,
    item.quantity,
    formatCurrency(item.unitPrice, currency),
    formatCurrency(item.totalPrice, currency),
  ]);

  autoTable(doc, {
    startY: 74,
    head: [["#", "Description / Service", "Qty", "Unit Rate", "Total"]],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [15, 39, 68],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 95 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Financial Breakdown Summary
  // @ts-expect-error - jsPDF autoTable attaches lastAutoTable
  const finalY = doc.lastAutoTable.finalY + 8;

  const summaryX = 120;
  const valueX = 196;

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  let currentY = finalY;

  doc.text("Room Charges / Subtotal:", summaryX, currentY);
  doc.text(formatCurrency(data.subtotal, currency), valueX, currentY, { align: "right" });
  currentY += 5;

  if (data.additionalCharges > 0) {
    doc.text("Additional Charges:", summaryX, currentY);
    doc.text(formatCurrency(data.additionalCharges, currency), valueX, currentY, { align: "right" });
    currentY += 5;
  }

  if (data.discountAmount > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text("Discount Applied:", summaryX, currentY);
    doc.text(`- ${formatCurrency(data.discountAmount, currency)}`, valueX, currentY, { align: "right" });
    doc.setTextColor(71, 85, 105);
    currentY += 5;
  }

  if (data.taxAmount > 0) {
    doc.text("VAT / Taxes:", summaryX, currentY);
    doc.text(formatCurrency(data.taxAmount, currency), valueX, currentY, { align: "right" });
    currentY += 5;
  }

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX, currentY, valueX, currentY);
  currentY += 5;

  // Grand Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Total Bill:", summaryX, currentY);
  doc.text(formatCurrency(data.totalAmount, currency), valueX, currentY, { align: "right" });
  currentY += 6;

  // Amount Paid
  doc.setFontSize(9);
  doc.setTextColor(4, 120, 87); // Green
  doc.text("Amount Paid:", summaryX, currentY);
  doc.text(formatCurrency(data.paidAmount, currency), valueX, currentY, { align: "right" });
  currentY += 6;

  // Remaining Balance
  doc.setFontSize(10);
  if (data.outstandingBalance > 0) {
    doc.setTextColor(190, 18, 60); // Red
  } else {
    doc.setTextColor(4, 120, 87); // Green
  }
  doc.text("Balance Due:", summaryX, currentY);
  doc.text(formatCurrency(data.outstandingBalance, currency), valueX, currentY, { align: "right" });

  // Payments History Box if any
  if (data.payments && data.payments.length > 0) {
    let payY = finalY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text("Payment Transactions Received:", 14, payY);
    payY += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    for (const p of data.payments) {
      const refStr = p.transactionRef ? ` (Ref: ${p.transactionRef})` : "";
      doc.text(
        `• ${formatDate(p.paymentDate)}: ${formatCurrency(p.amount, currency)} via ${p.method}${refStr}`,
        14,
        payY
      );
      payY += 4;
    }
  }

  // Footer & Signature Block
  const footerY = 270;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY, 196, footerY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Thank you for staying with us! Computer generated tax invoice.", 14, footerY + 6);
  doc.text("Authorized Signature & Stamp", 196, footerY + 6, { align: "right" });

  // Save the PDF
  doc.save(`${data.invoiceNumber}.pdf`);
}
