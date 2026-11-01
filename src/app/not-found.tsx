import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-[#0F2744] mb-4">
          <Building2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">404 - Page Not Found</h1>
        <p className="text-xs text-slate-500 mt-2">
          The hotel management page or requested resource could not be found.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="primary" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
