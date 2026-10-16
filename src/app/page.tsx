import { redirect } from "next/navigation";
import { canViewDashboard, requireUser } from "@/lib/auth";

export default async function Home() {
  const ctx = await requireUser();
  redirect(canViewDashboard(ctx) ? "/dashboard" : "/billing/new");
}
