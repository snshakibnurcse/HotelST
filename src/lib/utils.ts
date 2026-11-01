import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | { toString(): string } | null | undefined, currency = "BDT"): string {
  const num = typeof amount === "number" ? amount : Number(amount || 0);
  return `${currency} ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date | string | null | undefined, formatStr = "dd MMM yyyy"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function maskNid(nid?: string | null): string {
  if (!nid) return "—";
  if (nid.length <= 4) return "****";
  return "*".repeat(nid.length - 4) + nid.slice(-4);
}

export type DateFilterType = "today" | "yesterday" | "this_week" | "this_month" | "previous_month" | "custom";

export function resolveDateRange(filterType: DateFilterType, customStart?: string, customEnd?: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (filterType) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "this_week": {
      // Sat to Fri week range
      const day = now.getDay();
      const diffToSat = (day + 1) % 7;
      const start = new Date(now);
      start.setDate(now.getDate() - diffToSat);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case "previous_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case "custom":
      return {
        start: customStart ? startOfDay(new Date(customStart)) : new Date(now.getFullYear(), now.getMonth(), 1),
        end: customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now),
      };
    default:
      return {
        start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: endOfDay(now),
      };
  }
}

