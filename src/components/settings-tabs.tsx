import Link from "next/link";

const TABS = [
  { href: "/settings", label: "Salon" },
  { href: "/settings/users", label: "Sub-admins" },
  { href: "/settings/branches", label: "Branches" },
  { href: "/settings/billing", label: "Plan & payment" },
  { href: "/settings/audit", label: "Audit log" },
];

export function SettingsTabs({ active, extra = [] }: { active: string; extra?: { href: string; label: string }[] }) {
  return (
    <div className="mb-6 flex gap-1 border-b border-stone-200">
      {[...TABS, ...extra].map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${
            active === t.href ? "border-gold font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
