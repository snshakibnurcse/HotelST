"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createGuestAction, getGuestDetailsAction } from "@/actions/guests";
import { Users, Search, Plus, Phone, Mail, MapPin, History, ShieldAlert } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface GuestSummary {
  id: string;
  hotelId: string;
  fullName: string;
  mobile: string;
  email?: string | null;
  nidMasked: string;
  city?: string | null;
  country?: string | null;
  totalStays: number;
  totalSpent: number;
  totalOutstanding: number;
  createdAt: Date | string;
}

interface GuestsDirectoryViewProps {
  hotelId: string;
  guests: GuestSummary[];
  isReadOnly?: boolean;
}

export function GuestsDirectoryView({ hotelId, guests, isReadOnly = false }: GuestsDirectoryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("search") || "");

  // Add Guest Modal
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [fullName, setFullName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [nidPassport, setNidPassport] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Guest Stays History Modal
  const [selectedGuestId, setSelectedGuestId] = React.useState<string | null>(null);
  const [guestDetails, setGuestDetails] = React.useState<any>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) params.set("search", search.trim());
    else params.delete("search");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    const res = await createGuestAction(hotelId, {
      fullName,
      mobile,
      email: email || undefined,
      nidPassport: nidPassport || undefined,
      address: address || undefined,
      city: city || undefined,
      country: "Bangladesh",
      nationality: "Bangladeshi",
    });

    setIsSaving(false);
    if (res.success) {
      setIsAddOpen(false);
      setFullName("");
      setMobile("");
      setEmail("");
      setNidPassport("");
      setAddress("");
      setCity("");
      router.refresh();
    } else {
      setErrorMsg(res.error || "Failed to create guest");
    }
  };

  const handleViewHistory = async (guestId: string) => {
    setSelectedGuestId(guestId);
    setLoadingDetails(true);
    try {
      const details = await getGuestDetailsAction(hotelId, guestId);
      setGuestDetails(details);
    } catch {
      alert("Failed to load guest history");
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Guest Management & Stay History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized guest records, loyalty stay history, and privacy-protected NID verification.
          </p>
        </div>

        {!isReadOnly && (
          <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Register New Guest
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, NID, or email..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
      </form>

      {/* Guests Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Guest Name</th>
                  <th className="py-3 px-4 font-semibold">Mobile Phone</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">NID / Passport</th>
                  <th className="py-3 px-4 font-semibold">City / Country</th>
                  <th className="py-3 px-4 font-semibold">Total Stays</th>
                  <th className="py-3 px-4 font-semibold">Lifetime Spend</th>
                  <th className="py-3 px-4 font-semibold">Outstanding Due</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guests.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900">{g.fullName}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{g.mobile}</td>
                    <td className="py-3 px-4 text-slate-500">{g.email || "—"}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{g.nidMasked}</td>
                    <td className="py-3 px-4 text-slate-600">{g.city ? `${g.city}, ${g.country}` : g.country}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{g.totalStays} stay(s)</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{formatCurrency(g.totalSpent)}</td>
                    <td className="py-3 px-4">
                      {g.totalOutstanding > 0 ? (
                        <span className="font-bold text-rose-600">{formatCurrency(g.totalOutstanding)}</span>
                      ) : (
                        <span className="font-bold text-emerald-600">0.00</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleViewHistory(g.id)}
                        className="px-2.5 py-1 rounded bg-[#0F2744]/10 text-[#0F2744] hover:bg-[#0F2744]/20 font-semibold text-[10px] cursor-pointer inline-flex items-center gap-1"
                      >
                        <History className="w-3 h-3" />
                        View History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Guest Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Register Guest Profile"
        description="Add a new guest identity to this hotel's guest registry."
      >
        <form onSubmit={handleCreateGuest} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Full Name"
              required
              placeholder="e.g. Shakil Ahmed"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label="Mobile Number"
              required
              placeholder="+8801700000000"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email"
              type="email"
              placeholder="shakil@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="National ID / Passport"
              placeholder="NID number"
              value={nidPassport}
              onChange={(e) => setNidPassport(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="City"
              placeholder="e.g. Dhaka"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              label="Street Address"
              placeholder="e.g. House 12, Road 4"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
              Save Guest Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* Guest Stay History Modal */}
      {selectedGuestId && (
        <Modal
          isOpen={!!selectedGuestId}
          onClose={() => {
            setSelectedGuestId(null);
            setGuestDetails(null);
          }}
          title={guestDetails ? `${guestDetails.fullName}'s Stay History` : "Loading Guest History..."}
          description="Chronological record of all stays, invoices, and payments."
          maxWidth="3xl"
        >
          {loadingDetails ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading stay history from database...</div>
          ) : guestDetails ? (
            <div className="space-y-4">
              {/* Profile summary */}
              <div className="p-3 bg-slate-50 rounded-lg text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-slate-400 block">Mobile:</span>
                  <span className="font-semibold text-slate-800">{guestDetails.mobile}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">NID / Passport:</span>
                  <span className="font-mono font-semibold text-slate-800">{guestDetails.displayNid || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Email:</span>
                  <span className="font-semibold text-slate-800">{guestDetails.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">City:</span>
                  <span className="font-semibold text-slate-800">{guestDetails.city || "—"}</span>
                </div>
              </div>

              {/* Stays list */}
              <div>
                <span className="text-xs font-bold text-slate-900 block mb-2">Historical Stays</span>
                <div className="space-y-2">
                  {guestDetails.reservations?.map((res: any) => (
                    <div key={res.id} className="p-3 border border-slate-200 rounded-lg bg-white text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          {res.reservationNumber} • Room {res.room.roomNumber} ({res.room.roomType.name})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            res.status === "CHECKED_IN"
                              ? "bg-emerald-100 text-emerald-800"
                              : res.status === "CONFIRMED"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {res.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>
                          {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)} ({res.totalNights} Nights)
                        </span>
                        <span className="font-semibold text-slate-900">
                          Bill: {formatCurrency(Number(res.totalAmount))} | Paid: {formatCurrency(Number(res.paidAmount))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedGuestId(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
