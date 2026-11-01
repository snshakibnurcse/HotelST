"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { createHotelAction, toggleHotelStatusAction } from "@/actions/hotels";
import { Plus, Building2, MapPin, Phone, Mail, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface HotelItem {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  starRating: number;
  currency: string;
  taxRate: number | { toString(): string };
  isActive: boolean;
  _count: {
    rooms: number;
    reservations: number;
    guests: number;
  };
}

export function HotelsManagementView({ hotels }: { hotels: HotelItem[] }) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [starRating, setStarRating] = React.useState("4");
  const [currency, setCurrency] = React.useState("BDT");
  const [taxRate, setTaxRate] = React.useState("5");
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    const res = await createHotelAction({
      name,
      code,
      address,
      city,
      country: "Bangladesh",
      phone,
      email,
      starRating: parseInt(starRating) || 3,
      currency,
      taxRate: parseFloat(taxRate) || 0,
      checkInTime: "14:00",
      checkOutTime: "12:00",
    });

    setIsSaving(false);
    if (res.success) {
      setIsAddOpen(false);
      setName("");
      setCode("");
      setAddress("");
      setCity("");
      setPhone("");
      setEmail("");
      router.refresh();
    } else {
      setErrorMsg(res.error || "Failed to create hotel");
    }
  };

  const handleToggleActive = async (hotelId: string) => {
    const res = await toggleHotelStatusAction(hotelId);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Failed to toggle status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Hotel Directory & Tenant Setup
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure hotel branches, physical locations, currencies, and tax policies.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Create New Hotel
        </Button>
      </div>

      {/* Hotel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {hotels.map((h) => (
          <Card key={h.id} className="hover:border-slate-400 transition-all shadow-2xs">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div>
                <span className="font-bold text-base text-slate-900 block">{h.name}</span>
                <span className="text-xs font-semibold text-[#C59B27] block font-mono">
                  CODE: {h.code} • {"★".repeat(h.starRating)}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  h.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                }`}
              >
                {h.isActive ? "Active" : "Inactive"}
              </span>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-xs">
              <div className="text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{h.address}, {h.city}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{h.phone}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{h.email}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <span className="text-slate-400 block">Rooms</span>
                  <span className="font-bold text-slate-800">{h._count.rooms}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Bookings</span>
                  <span className="font-bold text-slate-800">{h._count.reservations}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">VAT</span>
                  <span className="font-bold text-slate-800">{Number(h.taxRate)}%</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[11px] w-full"
                  onClick={() => handleToggleActive(h.id)}
                >
                  {h.isActive ? "Deactivate Hotel" : "Activate Hotel"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Hotel Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Create New Hotel Tenant"
        description="Initialize a new hotel with isolated inventory, reservations, and ledger."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Hotel Name"
              required
              placeholder="e.g. Sylhet Grand Resort"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Hotel Code (Unique)"
              required
              placeholder="e.g. SGR"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="City"
              required
              placeholder="e.g. Sylhet"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              label="Address"
              required
              placeholder="e.g. Airport Road"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Phone"
              required
              placeholder="+8801..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Official Email"
              type="email"
              required
              placeholder="info@hotel.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Star Rating (1-5)"
              type="number"
              min="1"
              max="5"
              value={starRating}
              onChange={(e) => setStarRating(e.target.value)}
            />
            <Input
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
            <Input
              label="VAT Rate (%)"
              type="number"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
              Create Hotel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
