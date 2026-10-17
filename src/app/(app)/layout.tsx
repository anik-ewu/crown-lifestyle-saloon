import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { setCurrentBranch } from "@/app/actions/branch";
import { Nav, type NavItem } from "@/components/nav";
import { Notice } from "@/components/ui";
import { canViewDashboard, isPlatformAdmin, requireUser } from "@/lib/auth";
import { activeBranches, currentBranchId } from "@/lib/branch";
import { subscriptionState } from "@/lib/plans";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireUser();
  const admin = ctx.isAdmin;
  const [branches, branchId] = await Promise.all([activeBranches(ctx), currentBranchId(ctx)]);
  const sub = subscriptionState(ctx.salon);

  const items: NavItem[] = [
    ...(canViewDashboard(ctx) ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    { href: "/appointments", label: "Appointments" },
    { href: "/customers", label: "Customers" },
    { href: "/invoices", label: "Invoices" },
    { href: "/reminders", label: "Reminders" },
    { href: "/reports/closing", label: "Daily closing", group: "More" },
    { href: "/reports/birthdays", label: "Birthdays", group: "More" },
    ...(admin
      ? [
          { href: "/reports/commission", label: "Commission", group: "More" },
          { href: "/expenses", label: "Expenses", group: "More" },
          { href: "/catalog/services", label: "Services", group: "Manage" },
          { href: "/catalog/packages", label: "Packages", group: "Manage" },
          { href: "/products", label: "Products & stock", group: "Manage" },
          { href: "/staff", label: "Salon members", group: "Manage" },
          { href: "/settings", label: "Settings", group: "Manage" },
        ]
      : []),
    ...(isPlatformAdmin(ctx) ? [{ href: "/platform", label: "Platform" }] : []),
  ];

  const branchPicker =
    branches.length > 1 && !ctx.user.branchId ? (
      <form action={setCurrentBranch} className="lg:mb-4 lg:px-2">
        <select
          name="branchId"
          defaultValue={branchId}
          aria-label="Branch"
          className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-stone-200"
        >
          {branches.map((b) => <option key={b.id} value={b.id} className="text-black">{b.name}</option>)}
        </select>
        <button className="mt-1 text-xs text-stone-400 hover:text-white">Switch branch</button>
      </form>
    ) : branches.length > 1 ? (
      <p className="px-2 text-xs text-stone-400 lg:mb-4">{branches.find((b) => b.id === branchId)?.name} branch</p>
    ) : null;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="relative flex items-center justify-between gap-3 bg-ink px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:flex-col lg:items-stretch lg:justify-start lg:overflow-y-auto lg:py-5">
        <Link href="/" className="flex items-center gap-2.5 lg:mb-6 lg:px-2">
          {ctx.salon.logoUrl ? (
            <Image src={ctx.salon.logoUrl} alt="" width={36} height={36} className="rounded-full" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
              {ctx.salon.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-sm font-semibold leading-tight text-gold-light">
            {ctx.salon.name}
          </span>
        </Link>
        <div className="hidden lg:block">{branchPicker}</div>
        <Nav
          items={items}
          primary={{ href: "/billing/new", label: "New bill" }}
          footer={
            <div className="space-y-3">
              {branchPicker}
              <div className="flex items-center justify-between text-sm text-stone-300">
                <Link href="/account">{ctx.user.name}</Link>
                <form action={logoutAction}>
                  <button className="text-stone-400 hover:text-white">Sign out</button>
                </form>
              </div>
            </div>
          }
        />
        <div className="hidden border-t border-white/10 pt-4 text-sm lg:mt-auto lg:block lg:px-2">
          <p className="truncate font-medium text-stone-200">{ctx.user.name}</p>
          <p className="text-xs text-stone-500">{admin ? "Admin" : "Sub-admin"}</p>
          <div className="mt-2 flex gap-3 text-xs">
            <Link href="/account" className="text-stone-400 hover:text-white">My account</Link>
            <form action={logoutAction}>
              <button className="text-stone-400 hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        {sub.notice && (
          <div className="mb-4">
            <Notice tone={sub.tone}>
              {sub.notice}{" "}
              {admin && <Link href="/settings/billing" className="font-medium underline">Plan & payment</Link>}
            </Notice>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
