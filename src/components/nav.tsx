"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string; group?: string };

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
const STORE = "nav-open-groups";

function readOpen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch {
    return [];
  }
}

function NavGroup({ name, items, pathname, onNavigate }: { name: string; items: NavItem[]; pathname: string; onNavigate: () => void }) {
  const containsActive = items.some((i) => isActive(pathname, i.href));
  const ref = useRef<HTMLDetailsElement>(null);

  // reopen groups the user left open last time (DOM only, after hydration)
  useEffect(() => {
    if (ref.current && !containsActive && readOpen().includes(name)) ref.current.open = true;
  }, [name, containsActive]);

  function remember(open: boolean) {
    try {
      const rest = readOpen().filter((g) => g !== name);
      localStorage.setItem(STORE, JSON.stringify(open ? [...rest, name] : rest));
    } catch {
      // storage unavailable: the group just won't be remembered
    }
  }

  return (
    <li className="mt-2">
      <details ref={ref} open={containsActive || undefined} onToggle={(e) => remember((e.target as HTMLDetailsElement).open)} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2 text-sm text-stone-400 hover:bg-white/5 hover:text-white [&::-webkit-details-marker]:hidden">
          {name}
          <svg viewBox="0 0 20 20" className="size-4 transition-transform group-open:rotate-90" aria-hidden="true">
            <path d="M7 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <ul className="mt-0.5 space-y-0.5 border-l border-white/10 pl-2 ml-3">
          {items.map((item) => <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} onNavigate={onNavigate} />)}
        </ul>
      </details>
    </li>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-gold/15 font-medium text-gold-light" : "text-stone-300 hover:bg-white/5 hover:text-white"}`}
      >
        {item.label}
      </Link>
    </li>
  );
}

export function Nav({ items, primary, footer }: { items: NavItem[]; primary?: NavItem; footer?: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const top = items.filter((i) => !i.group);
  const groups = [...new Set(items.filter((i) => i.group).map((i) => i.group!))];

  const links = (
    <>
      {primary && (
        <Link
          href={primary.href}
          onClick={close}
          className="mb-3 flex h-10 items-center justify-center rounded-md bg-gold text-sm font-semibold text-ink hover:bg-gold-light"
        >
          + {primary.label}
        </Link>
      )}
      <ul className="space-y-0.5">
        {top.map((item) => <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} onNavigate={close} />)}
        {groups.map((g) => (
          <NavGroup key={g} name={g} items={items.filter((i) => i.group === g)} pathname={pathname} onNavigate={close} />
        ))}
      </ul>
    </>
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
        <nav className="absolute inset-x-0 top-full z-20 max-h-[80vh] overflow-y-auto bg-ink p-3 shadow-lg lg:hidden">
          {links}
          {footer && <div className="mt-3 border-t border-white/10 px-3 pt-3">{footer}</div>}
        </nav>
      )}
    </>
  );
}
