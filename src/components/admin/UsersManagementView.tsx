"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  createUserAction,
  assignHotelAccessAction,
  removeHotelAccessAction,
  resetPasswordAction,
  toggleUserStatusAction,
} from "@/actions/users";
import { formatDate } from "@/lib/utils";
import { Plus, UserPlus, KeyRound, ShieldAlert, CheckCircle, Shield, Building2 } from "lucide-react";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date | string;
  hotelAssignments: Array<{ hotel: { id: string; name: string; code: string } }>;
  investorAccess: Array<{ hotel: { id: string; name: string; code: string } }>;
}

interface HotelOption {
  id: string;
  name: string;
  code: string;
}

interface UsersManagementViewProps {
  users: UserItem[];
  hotels: HotelOption[];
}

export function UsersManagementView({ users, hotels }: UsersManagementViewProps) {
  const router = useRouter();

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [role, setRole] = React.useState<Role>(Role.MANAGER);
  const [assignedHotelId, setAssignedHotelId] = React.useState(hotels[0]?.id || "");
  const [isCreating, setIsCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Assign Hotel Modal
  const [assigningUser, setAssigningUser] = React.useState<UserItem | null>(null);
  const [targetHotelId, setTargetHotelId] = React.useState(hotels[0]?.id || "");
  const [isAssigning, setIsAssigning] = React.useState(false);

  // Reset Password Modal
  const [resettingUser, setResettingUser] = React.useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = React.useState("");
  const [isResetting, setIsResetting] = React.useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    const res = await createUserAction({
      email,
      fullName,
      password,
      phone: phone || undefined,
      role,
      assignedHotelId: assignedHotelId || undefined,
    });

    setIsCreating(false);
    if (res.success) {
      setIsCreateOpen(false);
      setEmail("");
      setFullName("");
      setPassword("");
      setPhone("");
      router.refresh();
    } else {
      setCreateError(res.error || "Failed to create user account");
    }
  };

  const handleAssignHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningUser) return;

    setIsAssigning(true);
    const res = await assignHotelAccessAction({
      userId: assigningUser.id,
      hotelId: targetHotelId,
      type: assigningUser.role === Role.INVESTOR ? "INVESTOR" : "MANAGER",
    });

    setIsAssigning(false);
    if (res.success) {
      setAssigningUser(null);
      router.refresh();
    } else {
      alert(res.error || "Failed to assign hotel");
    }
  };

  const handleRemoveAssignment = async (userId: string, hotelId: string, role: Role) => {
    if (!confirm("Are you sure you want to remove this hotel assignment?")) return;
    const res = await removeHotelAccessAction({
      userId,
      hotelId,
      type: role === Role.INVESTOR ? "INVESTOR" : "MANAGER",
    });
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Failed to remove assignment");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;

    setIsResetting(true);
    const res = await resetPasswordAction(resettingUser.id, newPassword);
    setIsResetting(false);

    if (res.success) {
      setResettingUser(null);
      setNewPassword("");
      alert("Password has been successfully updated.");
    } else {
      alert(res.error || "Failed to reset password");
    }
  };

  const handleToggleStatus = async (userId: string) => {
    const res = await toggleUserStatusAction(userId);
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
            User Accounts & Hotel Access Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create user credentials, assign Manager permissions, and grant Investor portfolios.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1.5" />
          Create User Account
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-semibold">User Full Name</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">System Role</th>
                  <th className="py-3 px-4 font-semibold">Assigned Hotel(s)</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Created Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const assignedHotels =
                    u.role === Role.INVESTOR
                      ? u.investorAccess.map((a) => a.hotel)
                      : u.hotelAssignments.map((a) => a.hotel);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-slate-900">{u.fullName}</td>
                      <td className="py-3 px-4 text-slate-700">{u.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === "ADMIN"
                              ? "bg-purple-100 text-purple-800"
                              : u.role === "INVESTOR"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.role === Role.ADMIN ? (
                          <span className="text-[11px] font-semibold text-purple-700">All Hotels (Full Admin)</span>
                        ) : assignedHotels.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedHotels.map((h) => (
                              <span
                                key={h.id}
                                className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-medium"
                              >
                                {h.name} ({h.code})
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAssignment(u.id, h.id, u.role)}
                                  className="text-slate-400 hover:text-rose-600 font-bold ml-0.5 cursor-pointer"
                                  title="Remove assignment"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">
                            {u.role === Role.INVESTOR ? "All Active Hotels (Portfolio)" : "Unassigned"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isActive ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {u.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(u.createdAt)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.role !== Role.ADMIN && (
                            <button
                              onClick={() => {
                                setAssigningUser(u);
                                setTargetHotelId(hotels[0]?.id || "");
                              }}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold cursor-pointer"
                              title="Assign hotel"
                            >
                              + Assign Hotel
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setResettingUser(u);
                              setNewPassword("");
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            title="Reset password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u.id)}
                            className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-semibold cursor-pointer"
                          >
                            {u.isActive ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New User Account"
        description="Provision access credentials for Hotel Managers or Investors."
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <Input
            label="Full Name"
            required
            placeholder="e.g. Tariqul Islam"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <Input
            label="Email Address"
            type="email"
            required
            placeholder="name@sthotel.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Initial Secure Password (min 8 chars)"
            type="password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="MANAGER">Hotel Manager</option>
                <option value="INVESTOR">Investor (Read-Only)</option>
                <option value="ADMIN">System Administrator</option>
              </select>
            </div>
            <Input
              label="Contact Phone"
              placeholder="+8801..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {role !== Role.ADMIN && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Assign Initial Hotel
              </label>
              <select
                value={assignedHotelId}
                onChange={(e) => setAssignedHotelId(e.target.value)}
                className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">-- No Initial Assignment --</option>
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Hotel Modal */}
      {assigningUser && (
        <Modal
          isOpen={!!assigningUser}
          onClose={() => setAssigningUser(null)}
          title={`Assign Hotel to ${assigningUser.fullName}`}
          description={`Select which hotel ${assigningUser.fullName} (${assigningUser.role}) is granted access to.`}
        >
          <form onSubmit={handleAssignHotel} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Select Hotel</label>
              <select
                value={targetHotelId}
                onChange={(e) => setTargetHotelId(e.target.value)}
                className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setAssigningUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isAssigning}>
                Confirm Assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <Modal
          isOpen={!!resettingUser}
          onClose={() => setResettingUser(null)}
          title={`Reset Password: ${resettingUser.fullName}`}
          description={`Set a new temporary or permanent password for ${resettingUser.email}.`}
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            <Input
              label="New Password (min 8 characters)"
              type="password"
              required
              placeholder="••••••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setResettingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isResetting}>
                Update Password
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
