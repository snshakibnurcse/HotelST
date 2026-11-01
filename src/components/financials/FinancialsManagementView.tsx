"use client";

import * as React from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  createFinancialTransactionAction,
  reverseFinancialTransactionAction,
} from "@/actions/financials";
import { Plus, RotateCcw, TrendingUp, TrendingDown, ShieldAlert, CheckCircle, Search } from "lucide-react";
import { PaymentMethod, TransactionType } from "@prisma/client";
import { useRouter } from "next/navigation";

interface TransactionItem {
  id: string;
  transactionNumber: string;
  type: TransactionType;
  amount: number | { toString(): string };
  transactionDate: Date | string;
  description: string;
  reference?: string | null;
  paymentMethod: PaymentMethod;
  isReversed: boolean;
  reversalReason?: string | null;
  category: { id: string; name: string };
  createdBy?: { fullName: string } | null;
}

interface CategoryOption {
  id: string;
  name: string;
  type: TransactionType;
}

interface FinancialsManagementViewProps {
  hotelId: string;
  transactions: TransactionItem[];
  categories: CategoryOption[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  isReadOnly?: boolean;
}

export function FinancialsManagementView({
  hotelId,
  transactions,
  categories,
  pagination,
  isReadOnly = false,
}: FinancialsManagementViewProps) {
  const router = useRouter();

  // Add Transaction Modal
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [txType, setTxType] = React.useState<TransactionType>(TransactionType.EXPENSE);
  const [categoryId, setCategoryId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [transactionDate, setTransactionDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(PaymentMethod.CASH);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Reversal Modal
  const [reversingTxId, setReversingTxId] = React.useState<string | null>(null);
  const [reversalReason, setReversalReason] = React.useState("");
  const [isReversing, setIsReversing] = React.useState(false);

  // Available categories matching chosen type
  const availableCategories = categories.filter((c) => c.type === txType);

  React.useEffect(() => {
    if (availableCategories.length > 0 && !categoryId) {
      setCategoryId(availableCategories[0].id);
    }
  }, [availableCategories, categoryId]);

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    const res = await createFinancialTransactionAction(hotelId, {
      type: txType,
      categoryId: categoryId || availableCategories[0]?.id,
      amount: parseFloat(amount) || 0,
      transactionDate,
      description,
      reference: reference || undefined,
      paymentMethod,
    });

    setIsSaving(false);
    if (res.success) {
      setIsAddOpen(false);
      setDescription("");
      setAmount("");
      setReference("");
      router.refresh();
    } else {
      setErrorMsg(res.error || "Failed to record transaction");
    }
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingTxId) return;

    setIsReversing(true);
    const res = await reverseFinancialTransactionAction(hotelId, reversingTxId, reversalReason);
    setIsReversing(false);

    if (res.success) {
      setReversingTxId(null);
      setReversalReason("");
      router.refresh();
    } else {
      alert(res.error || "Failed to reverse transaction");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Financial Ledger: Income & Expenses
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational expenses, non-room revenues, cash flow logs, and audited corrections.
          </p>
        </div>

        {!isReadOnly && (
          <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Record Transaction
          </Button>
        )}
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Tx #</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Method / Ref</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  {!isReadOnly && <th className="py-3 px-4 font-semibold text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-slate-50/70 ${tx.isReversed ? "opacity-40 line-through" : ""}`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{tx.transactionNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDate(tx.transactionDate)}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.type === "INCOME"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {tx.type === "INCOME" ? (
                          <TrendingUp className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-rose-600" />
                        )}
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{tx.category.name}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                      {tx.description}
                      {tx.isReversed && (
                        <span className="block text-[10px] text-rose-600 font-semibold no-underline">
                          Reversed: {tx.reversalReason}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {tx.paymentMethod} {tx.reference ? `(${tx.reference})` : ""}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        tx.type === "INCOME" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatCurrency(tx.amount)}
                    </td>
                    {!isReadOnly && (
                      <td className="py-3 px-4 text-right">
                        {!tx.isReversed && (
                          <button
                            onClick={() => setReversingTxId(tx.id)}
                            className="px-2 py-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-semibold text-[10px] cursor-pointer inline-flex items-center gap-1"
                            title="Reverse transaction"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reverse
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Transaction Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Record Financial Transaction"
        description="Add operating expenses or non-room revenues with category classification."
      >
        <form onSubmit={handleCreateTx} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Selector (Income vs Expense) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setTxType(TransactionType.EXPENSE);
                setCategoryId("");
              }}
              className={`py-2 text-xs font-bold rounded-lg border cursor-pointer transition ${
                txType === TransactionType.EXPENSE
                  ? "bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-600/20"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Operating Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setTxType(TransactionType.INCOME);
                setCategoryId("");
              }}
              className={`py-2 text-xs font-bold rounded-lg border cursor-pointer transition ${
                txType === TransactionType.INCOME
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-600/20"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Other Hotel Income
            </button>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
            >
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount (BDT)"
              type="number"
              step="0.01"
              required
              placeholder="e.g. 15000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              label="Transaction Date"
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>

          <Input
            label="Description"
            required
            placeholder="e.g. DPDC Electricity bill for floor 1-3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Payment Channel</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Wire</option>
                <option value="BKASH">bKash</option>
                <option value="NAGAD">Nagad</option>
                <option value="CARD_POS">Card / POS</option>
              </select>
            </div>
            <Input
              label="Voucher / Reference No."
              placeholder="e.g. BILL-9483 or Voucher #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
              Save Transaction
            </Button>
          </div>
        </form>
      </Modal>

      {/* Audited Reversal Modal */}
      {reversingTxId && (
        <Modal
          isOpen={!!reversingTxId}
          onClose={() => setReversingTxId(null)}
          title="Reverse Financial Entry"
          description="Provide a justification for reversing this transaction. Reversals preserve full audit history."
        >
          <form onSubmit={handleConfirmReversal} className="space-y-4">
            <Input
              label="Reversal Reason"
              required
              placeholder="e.g. Duplicate entry by mistake / incorrect amount"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setReversingTxId(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm" isLoading={isReversing}>
                Confirm Reversal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
