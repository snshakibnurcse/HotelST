import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role === "ADMIN") {
    redirect("/admin");
  } else if (session.role === "INVESTOR") {
    redirect("/investor");
  } else {
    redirect("/dashboard");
  }
}
