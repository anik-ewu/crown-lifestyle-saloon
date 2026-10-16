"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string; section?: string };

export function Nav({ items, footer }: { items: NavItem[]; footer?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <ul className="space-y-0.5">
      {items.map((item, i) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const header = item.section && item.section !== items[i - 1]?.section ? item.section : null;
        return (
          <li key={item.href}>
            {header && (
              <p className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">{header}</p>
            )}
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm ${
                active ? "bg-gold/15 font-medium text-gold-light" : "text-stone-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-sm text-stone-200 ring-1 ring-white/20 lg:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Menu
      </button>
      <nav className="hidden lg:block">{links}</nav>
      {open && (
        <nav className="absolute inset-x-0 top-full z-20 bg-ink p-3 shadow-lg lg:hidden">
          {links}
          {footer && <div className="mt-3 border-t border-white/10 px-3 pt-3">{footer}</div>}
        </nav>
      )}
    </>
  );
}
