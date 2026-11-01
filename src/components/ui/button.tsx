import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost" | "gold";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-[#0F2744] text-white hover:bg-[#1E3A5F] active:bg-[#0A1B30] shadow-sm",
      secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300",
      outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100",
      danger: "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm",
      ghost: "text-slate-600 hover:bg-slate-100 active:bg-slate-200",
      gold: "bg-[#C59B27] text-white hover:bg-[#B3891E] active:bg-[#997316] shadow-sm",
    };

    const sizes = {
      sm: "px-2.5 py-1.5 text-xs font-medium rounded-md",
      md: "px-4 py-2 text-sm font-medium rounded-lg",
      lg: "px-5 py-2.5 text-base font-semibold rounded-lg",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#0F2744] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
