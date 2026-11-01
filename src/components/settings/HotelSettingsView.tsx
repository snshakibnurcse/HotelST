"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { updateHotelAction } from "@/actions/hotels";
import { Building2, Save, ShieldCheck } from "lucide-react";

interface HotelDetails {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website?: string | null;
  starRating: number;
  checkInTime: string;
  checkOutTime: string;
  currency: string;
  taxRate: number | { toString(): string };
}

export function HotelSettingsView({ hotel }: { hotel: HotelDetails }) {
  const [address, setAddress] = React.useState(hotel.address);
  const [city, setCity] = React.useState(hotel.city);
  const [phone, setPhone] = React.useState(hotel.phone);
  const [email, setEmail] = React.useState(hotel.email);
  const [website, setWebsite] = React.useState(hotel.website || "");
  const [checkInTime, setCheckInTime] = React.useState(hotel.checkInTime);
  const [checkOutTime, setCheckOutTime] = React.useState(hotel.checkOutTime);
  const [taxRate, setTaxRate] = React.useState(Number(hotel.taxRate).toString());
  const [isSaving, setIsSaving] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);

    const res = await updateHotelAction(hotel.id, {
      address,
      city,
      phone,
      email,
      website: website || undefined,
      checkInTime,
      checkOutTime,
      taxRate: parseFloat(taxRate) || 0,
    });

    setIsSaving(false);
    if (res.success) {
      setSuccessMsg("Hotel configuration updated successfully.");
    } else {
      alert(res.error || "Failed to update settings");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          Hotel Settings & Operational Policies
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage {hotel.name} ({hotel.code}) contact details, check-in schedules, and VAT policies.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">Hotel Profile & Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Street Address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Input
                label="City"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Contact Phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                label="Official Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Input
              label="Website URL"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold text-slate-900">Operating Policies & VAT</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Standard Check-In Time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
              <Input
                label="Standard Check-Out Time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
              />
              <Input
                label="VAT / Tax Rate (%)"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
            <Save className="w-4 h-4 mr-1.5" />
            Save Hotel Policies
          </Button>
        </div>
      </form>
    </div>
  );
}
