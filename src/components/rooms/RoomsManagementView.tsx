"use client";

import * as React from "react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  createRoomAction,
  updateRoomAction,
  archiveRoomAction,
  createRoomTypeAction,
} from "@/actions/rooms";
import { Plus, BedDouble, Wrench, Archive, Edit, CheckCircle, ShieldAlert } from "lucide-react";
import { RoomStatus } from "@prisma/client";

interface RoomItem {
  id: string;
  roomNumber: string;
  floor: string;
  status: RoomStatus;
  isClean: boolean;
  isArchived: boolean;
  description?: string | null;
  roomType: {
    id: string;
    name: string;
    basePrice: number | { toString(): string };
    bedConfiguration: string;
    maxAdults: number;
    maxChildren: number;
  };
}

interface RoomTypeItem {
  id: string;
  name: string;
  code: string;
  basePrice: number | { toString(): string };
  maxAdults: number;
  maxChildren: number;
  totalBeds: number;
  bedConfiguration: string;
}

interface RoomsManagementViewProps {
  hotelId: string;
  rooms: RoomItem[];
  roomTypes: RoomTypeItem[];
}

export function RoomsManagementView({ hotelId, rooms, roomTypes }: RoomsManagementViewProps) {
  const [activeTab, setActiveTab] = React.useState<"rooms" | "types">("rooms");

  // Add Room Modal State
  const [isAddRoomOpen, setIsAddRoomOpen] = React.useState(false);
  const [roomNumber, setRoomNumber] = React.useState("");
  const [floor, setFloor] = React.useState("1");
  const [roomTypeId, setRoomTypeId] = React.useState(roomTypes[0]?.id || "");
  const [roomStatus, setRoomStatus] = React.useState<RoomStatus>(RoomStatus.AVAILABLE);
  const [roomDesc, setRoomDesc] = React.useState("");
  const [isSavingRoom, setIsSavingRoom] = React.useState(false);
  const [roomError, setRoomError] = React.useState<string | null>(null);

  // Edit Room Modal State
  const [editingRoom, setEditingRoom] = React.useState<RoomItem | null>(null);
  const [editStatus, setEditStatus] = React.useState<RoomStatus>(RoomStatus.AVAILABLE);
  const [editClean, setEditClean] = React.useState(true);
  const [editFloor, setEditFloor] = React.useState("1");
  const [editTypeId, setEditTypeId] = React.useState("");

  // Add Room Type Modal State
  const [isAddTypeOpen, setIsAddTypeOpen] = React.useState(false);
  const [typeName, setTypeName] = React.useState("");
  const [typeCode, setTypeCode] = React.useState("");
  const [typePrice, setTypePrice] = React.useState("");
  const [typeAdults, setTypeAdults] = React.useState("2");
  const [typeBeds, setTypeBeds] = React.useState("1");
  const [typeBedConfig, setTypeBedConfig] = React.useState("1 King Bed");
  const [isSavingType, setIsSavingType] = React.useState(false);
  const [typeError, setTypeError] = React.useState<string | null>(null);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRoom(true);
    setRoomError(null);

    const res = await createRoomAction(hotelId, {
      roomNumber,
      floor,
      roomTypeId,
      status: roomStatus,
      description: roomDesc,
    });

    setIsSavingRoom(false);
    if (res.success) {
      setIsAddRoomOpen(false);
      setRoomNumber("");
      setRoomDesc("");
    } else {
      setRoomError(res.error || "Failed to create room");
    }
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    const res = await updateRoomAction(hotelId, editingRoom.id, {
      status: editStatus,
      isClean: editClean,
      floor: editFloor,
      roomTypeId: editTypeId,
    });

    if (res.success) {
      setEditingRoom(null);
    } else {
      alert(res.error || "Failed to update room");
    }
  };

  const handleArchiveRoom = async (roomId: string, roomNum: string) => {
    if (!confirm(`Are you sure you want to archive Room #${roomNum}? Active rooms with ongoing stays cannot be archived.`)) {
      return;
    }
    const res = await archiveRoomAction(hotelId, roomId);
    if (!res.success) {
      alert(res.error || "Failed to archive room");
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingType(true);
    setTypeError(null);

    const res = await createRoomTypeAction(hotelId, {
      name: typeName,
      code: typeCode,
      basePrice: parseFloat(typePrice),
      maxAdults: parseInt(typeAdults) || 2,
      maxChildren: 1,
      totalBeds: parseInt(typeBeds) || 1,
      bedConfiguration: typeBedConfig,
      amenities: ["Wi-Fi", "Air Conditioning", "TV"],
    });

    setIsSavingType(false);
    if (res.success) {
      setIsAddTypeOpen(false);
      setTypeName("");
      setTypeCode("");
      setTypePrice("");
    } else {
      setTypeError(res.error || "Failed to create category");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Rooms & Inventory Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage hotel room inventory, rates, capacities, and maintenance status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "rooms" ? (
            <Button variant="primary" size="sm" onClick={() => setIsAddRoomOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Room
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setIsAddTypeOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Room Category
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("rooms")}
          className={`pb-2.5 px-3 text-xs font-bold border-b-2 cursor-pointer transition ${
            activeTab === "rooms"
              ? "border-[#0F2744] text-[#0F2744]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          All Rooms ({rooms.length})
        </button>
        <button
          onClick={() => setActiveTab("types")}
          className={`pb-2.5 px-3 text-xs font-bold border-b-2 cursor-pointer transition ${
            activeTab === "types"
              ? "border-[#0F2744] text-[#0F2744]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Room Categories & Rates ({roomTypes.length})
        </button>
      </div>

      {/* Tab 1: Rooms Table */}
      {activeTab === "rooms" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Room #</th>
                    <th className="py-3 px-4 font-semibold">Floor</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Standard Rate</th>
                    <th className="py-3 px-4 font-semibold">Beds / Guests</th>
                    <th className="py-3 px-4 font-semibold">Housekeeping</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">#{room.roomNumber}</td>
                      <td className="py-3 px-4 font-medium text-slate-600">Floor {room.floor}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{room.roomType.name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {formatCurrency(room.roomType.basePrice)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {room.roomType.bedConfiguration} (Max {room.roomType.maxAdults} Adults)
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            room.isClean
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {room.isClean ? "Clean" : "Dirty"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            room.status === "AVAILABLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : room.status === "OCCUPIED"
                              ? "bg-rose-100 text-rose-800"
                              : room.status === "MAINTENANCE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {room.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingRoom(room);
                              setEditStatus(room.status);
                              setEditClean(room.isClean);
                              setEditFloor(room.floor);
                              setEditTypeId(room.roomType.id);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                            title="Edit room"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchiveRoom(room.id, room.roomNumber)}
                            className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Archive room"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Room Types Table */}
      {activeTab === "types" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Category Name</th>
                    <th className="py-3 px-4 font-semibold">Code</th>
                    <th className="py-3 px-4 font-semibold">Base Price</th>
                    <th className="py-3 px-4 font-semibold">Bedding Setup</th>
                    <th className="py-3 px-4 font-semibold">Max Adults</th>
                    <th className="py-3 px-4 font-semibold">Max Children</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomTypes.map((rt) => (
                    <tr key={rt.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">{rt.name}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-600">{rt.code}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {formatCurrency(rt.basePrice)}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{rt.bedConfiguration}</td>
                      <td className="py-3 px-4 text-slate-600">{rt.maxAdults}</td>
                      <td className="py-3 px-4 text-slate-600">{rt.maxChildren}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Room Modal */}
      <Modal
        isOpen={isAddRoomOpen}
        onClose={() => setIsAddRoomOpen(false)}
        title="Add New Room"
        description="Configure new room inventory with floor, category, and initial status."
      >
        <form onSubmit={handleCreateRoom} className="space-y-4">
          {roomError && (
            <div className="p-2.5 rounded bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{roomError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Room Number"
              required
              placeholder="e.g. 305"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
            />
            <Input
              label="Floor Number"
              required
              placeholder="e.g. 3"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase">Room Category</label>
            <select
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
              className="w-full text-xs font-medium p-2 border border-slate-300 rounded-lg bg-white"
            >
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} ({formatCurrency(rt.basePrice)}/night)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase">Operational Status</label>
            <select
              value={roomStatus}
              onChange={(e) => setRoomStatus(e.target.value as RoomStatus)}
              className="w-full text-xs font-medium p-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="AVAILABLE">Available for Guests</option>
              <option value="MAINTENANCE">Under Maintenance</option>
              <option value="OUT_OF_SERVICE">Out of Service</option>
            </select>
          </div>

          <Input
            label="Notes / Description"
            placeholder="e.g. Facing city view, near elevator"
            value={roomDesc}
            onChange={(e) => setRoomDesc(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddRoomOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSavingRoom}>
              Save Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Room Modal */}
      {editingRoom && (
        <Modal
          isOpen={!!editingRoom}
          onClose={() => setEditingRoom(null)}
          title={`Edit Room #${editingRoom.roomNumber}`}
          description="Update room category, floor, housekeeping, or maintenance status."
        >
          <form onSubmit={handleUpdateRoom} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Floor"
                value={editFloor}
                onChange={(e) => setEditFloor(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Category</label>
                <select
                  value={editTypeId}
                  onChange={(e) => setEditTypeId(e.target.value)}
                  className="w-full text-xs font-medium p-2 border border-slate-300 rounded-lg bg-white"
                >
                  {roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as RoomStatus)}
                  className="w-full text-xs font-medium p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="OCCUPIED">Occupied</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="OUT_OF_SERVICE">Out of Service</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase">Housekeeping</label>
                <select
                  value={editClean ? "true" : "false"}
                  onChange={(e) => setEditClean(e.target.value === "true")}
                  className="w-full text-xs font-medium p-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="true">Clean / Ready</option>
                  <option value="false">Dirty / Requires Cleaning</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingRoom(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Room Type Modal */}
      <Modal
        isOpen={isAddTypeOpen}
        onClose={() => setIsAddTypeOpen(false)}
        title="Add Room Category"
        description="Create a new room tier with standard pricing and maximum occupancy limits."
      >
        <form onSubmit={handleCreateType} className="space-y-4">
          {typeError && (
            <div className="p-2.5 rounded bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{typeError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Category Name"
              required
              placeholder="e.g. Royal Deluxe Suite"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
            />
            <Input
              label="Category Code (Unique)"
              required
              placeholder="e.g. RDS"
              value={typeCode}
              onChange={(e) => setTypeCode(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Standard Nightly Rate (BDT)"
              type="number"
              step="0.01"
              required
              placeholder="e.g. 7500"
              value={typePrice}
              onChange={(e) => setTypePrice(e.target.value)}
            />
            <Input
              label="Bedding Configuration"
              required
              placeholder="e.g. 1 King Bed"
              value={typeBedConfig}
              onChange={(e) => setTypeBedConfig(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Adult Capacity"
              type="number"
              value={typeAdults}
              onChange={(e) => setTypeAdults(e.target.value)}
            />
            <Input
              label="Total Beds"
              type="number"
              value={typeBeds}
              onChange={(e) => setTypeBeds(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddTypeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSavingType}>
              Save Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
