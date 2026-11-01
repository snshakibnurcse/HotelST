import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Access Restricted</h1>
        <p className="text-sm text-slate-600 mt-2">
          You do not have permission to access this hotel or administrative resource. If you believe this is an error, please contact your System Administrator.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/">
            <Button variant="primary" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Authorized Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
