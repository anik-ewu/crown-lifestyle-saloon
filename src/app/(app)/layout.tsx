import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Nav, type NavItem } from "@/components/nav";
import { canViewDashboard, requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireUser();
  const admin = ctx.isAdmin;

  const items: NavItem[] = [
    ...(canViewDashboard(ctx) ? [{ href: "/dashboard", label: "Dashboard" }] : []),
    { href: "/billing/new", label: "New bill" },
    { href: "/invoices", label: "Invoices" },
    { href: "/customers", label: "Customers" },
    { href: "/reminders", label: "Reminders" },
    { href: "/reports/closing", label: "Daily closing" },
    ...(admin
      ? [
          { href: "/catalog/services", label: "Services", section: "Manage" },
          { href: "/catalog/packages", label: "Packages", section: "Manage" },
          { href: "/staff", label: "Salon members", section: "Manage" },
          { href: "/settings", label: "Settings", section: "Manage" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="relative flex items-center justify-between gap-3 bg-ink px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:flex-col lg:items-stretch lg:justify-start lg:overflow-y-auto lg:py-5">
        <Link href="/" className="flex items-center gap-2.5 lg:mb-6 lg:px-2">
          <Image src="/logo.jpg" alt="" width={36} height={36} className="rounded-full" />
          <span className="text-sm font-semibold leading-tight text-gold-light">
            Crown
            <span className="block text-xs font-normal text-stone-400">LifeStyle Saloon</span>
          </span>
        </Link>
        <Nav
          items={items}
          footer={
            <div className="flex items-center justify-between text-sm text-stone-300">
              <span>{ctx.user.name}</span>
              <form action={logoutAction}>
                <button className="text-stone-400 hover:text-white">Sign out</button>
              </form>
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
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
