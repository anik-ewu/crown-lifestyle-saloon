"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { createInvoice, type BillPayload } from "@/app/actions/billing";
import { quickCreateCustomer, searchCustomers, type CustomerHit } from "@/app/actions/customers";
import { Button, Card, Field, Input, Notice, Select, buttonClass, inputClass } from "@/components/ui";
import { displayPhone, formatDate, money, toPoisha, PAYMENT_LABELS } from "@/lib/format";

type Service = { id: string; name: string; category: string; price: number };
type Pkg = { id: string; name: string; price: number; services: string[] };
type Staff = { id: string; name: string };
type Product = { id: string; name: string; price: number; stock: number };
type Method = BillPayload["payments"][number]["method"];

type Line =
  | { key: number; kind: "SERVICE" | "PACKAGE" | "PRODUCT"; id: string; name: string; unitPrice: number; qty: number; staffId: string | null }
  | { key: number; kind: "CUSTOM"; name: string; serviceIds: string[]; listPrice: number; price: number; save: boolean; staffId: string | null };

let nextKey = 1;

export function BillingForm({
  services,
  packages,
  staff,
  products,
  loyaltyEnabled,
  initialCustomer,
  discountLimit,
}: {
  services: Service[];
  packages: Pkg[];
  staff: Staff[];
  products: Product[];
  loyaltyEnabled: boolean;
  initialCustomer: CustomerHit | null;
  discountLimit: number | null;
}) {
  const [customer, setCustomer] = useState<CustomerHit | null>(initialCustomer);
  const [lines, setLines] = useState<Line[]>([]);
  const [lastStaff, setLastStaff] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"NONE" | "FLAT" | "PERCENT">("NONE");
  const [discountInput, setDiscountInput] = useState("");
  const [discountNote, setDiscountNote] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [payments, setPayments] = useState<{ method: Method; amount: string }[]>([{ method: "CASH", amount: "" }]);
  const [state, formAction, pending] = useActionState(createInvoice, {});

  const byCategory = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services) m.set(s.category, [...(m.get(s.category) ?? []), s]);
    return [...m.entries()];
  }, [services]);

  const lineTotal = (l: Line) => (l.kind === "CUSTOM" ? l.price : l.unitPrice * l.qty);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const discountValue =
    discountType === "FLAT" ? Math.max(0, toPoisha(discountInput) || 0) : discountType === "PERCENT" ? Math.max(0, Math.round(Number(discountInput) || 0)) : 0;
  const discountAmount = Math.min(subtotal, discountType === "PERCENT" ? Math.round((subtotal * Math.min(discountValue, 100)) / 100) : discountValue);
  const afterDiscount = subtotal - discountAmount;
  const maxPoints = loyaltyEnabled && customer ? Math.min(customer.loyaltyPoints, Math.floor(afterDiscount / 100)) : 0;
  const pointsRedeemed = Math.min(maxPoints, Math.max(0, Math.floor(Number(pointsInput) || 0)));
  const total = afterDiscount - pointsRedeemed * 100;
  const listTotal = lines.reduce((s, l) => s + (l.kind === "CUSTOM" ? l.listPrice : l.unitPrice * l.qty), 0);
  const effectivePct = listTotal > 0 ? ((listTotal - afterDiscount) / listTotal) * 100 : 0;
  const overLimit = discountLimit !== null && effectivePct > discountLimit + 0.01;

  const paymentAmounts = payments.length === 1 ? [total] : payments.map((p) => Math.max(0, toPoisha(p.amount) || 0));
  const paid = paymentAmounts.reduce((s, a) => s + a, 0);
  const remaining = total - paid;

  function addItem(kind: "SERVICE" | "PACKAGE" | "PRODUCT", id: string) {
    if (!id) return;
    const item =
      kind === "SERVICE" ? services.find((s) => s.id === id) : kind === "PRODUCT" ? products.find((p) => p.id === id) : packages.find((p) => p.id === id);
    if (!item) return;
    setLines((ls) => [...ls, { key: nextKey++, kind, id, name: item.name, unitPrice: item.price, qty: 1, staffId: lastStaff }]);
  }

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? ({ ...l, ...patch } as Line) : l)));
    if (patch.staffId !== undefined) setLastStaff(patch.staffId);
  }

  const payload: BillPayload | null = customer
    ? {
        customerId: customer.id,
        lines: lines.map((l) =>
          l.kind === "CUSTOM"
            ? { kind: "CUSTOM", name: l.name, serviceIds: l.serviceIds, price: l.price, save: l.save, staffId: l.staffId }
            : { kind: l.kind, id: l.id, qty: l.qty, staffId: l.staffId },
        ),
        discountType: discountAmount > 0 ? discountType : "NONE",
        discountValue: discountAmount > 0 ? discountValue : 0,
        discountNote,
        pointsRedeemed,
        payments: payments.map((p, i) => ({ method: p.method, amount: paymentAmounts[i] })),
      }
    : null;

  const canSubmit = !!payload && lines.length > 0 && remaining === 0 && !overLimit && !pending;

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-3">
      <input type="hidden" name="payload" value={payload ? JSON.stringify(payload) : ""} />
      <div className="space-y-6 xl:col-span-2">
        <CustomerPicker customer={customer} onChange={setCustomer} />

        <Card title="Services">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Add service">
              <Select value="" onChange={(e) => addItem("SERVICE", e.target.value)}>
                <option value="">Choose a service…</option>
                {byCategory.map(([cat, list]) => (
                  <optgroup key={cat} label={cat}>
                    {list.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(s.price)}</option>)}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Add package">
              <Select value="" onChange={(e) => addItem("PACKAGE", e.target.value)} disabled={packages.length === 0}>
                <option value="">{packages.length ? "Choose a package…" : "No packages yet"}</option>
                {packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
              </Select>
            </Field>
          </div>
          {products.length > 0 && (
            <Field label="Add product" className="mt-3 sm:w-1/2">
              <Select value="" onChange={(e) => addItem("PRODUCT", e.target.value)}>
                <option value="">Choose a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                    {p.name} · {money(p.price)} · {p.stock > 0 ? `${p.stock} left` : "out of stock"}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <CustomPackageBuilder
            services={services}
            onAdd={(c) => setLines((ls) => [...ls, { key: nextKey++, kind: "CUSTOM", staffId: lastStaff, ...c }])}
          />

          {lines.length > 0 && (
            <div className="mt-4 divide-y divide-stone-100 rounded-md border border-stone-200">
              {lines.map((l) => (
                <div key={l.key} className="grid grid-cols-12 items-center gap-2 p-2 text-sm">
                  <div className="col-span-12 sm:col-span-4">
                    <p className="font-medium">{l.name}</p>
                    {l.kind === "CUSTOM" && <p className="text-xs text-stone-500">Custom package · list {money(l.listPrice)}</p>}
                  </div>
                  <select
                    aria-label="Served by"
                    className={`${inputClass} col-span-6 py-2 sm:col-span-3`}
                    value={l.staffId ?? ""}
                    onChange={(e) => update(l.key, { staffId: e.target.value || null })}
                  >
                    <option value="">Served by…</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {l.kind === "CUSTOM" ? (
                    <span className="col-span-2" />
                  ) : (
                    <input
                      aria-label="Quantity"
                      type="number"
                      min={1}
                      max={20}
                      className={`${inputClass} col-span-2 py-2`}
                      value={l.qty}
                      onChange={(e) => update(l.key, { qty: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })}
                    />
                  )}
                  <span className="col-span-3 text-right tabular-nums sm:col-span-2">{money(lineTotal(l))}</span>
                  <button
                    type="button"
                    className="col-span-1 text-right text-stone-400 hover:text-red-600"
                    aria-label={`Remove ${l.name}`}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Payment">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
          </dl>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)} aria-label="Discount type">
              <option value="NONE">No discount</option>
              <option value="FLAT">Discount ৳</option>
              <option value="PERCENT">Discount %</option>
            </Select>
            <Input
              aria-label="Discount amount"
              inputMode="decimal"
              disabled={discountType === "NONE"}
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              placeholder={discountType === "PERCENT" ? "%" : "৳"}
            />
          </div>
          {discountType !== "NONE" && (
            <Input className="mt-2" placeholder="Reason (optional)" value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} maxLength={200} />
          )}
          {discountAmount > 0 && <p className="mt-2 flex justify-between text-sm"><span>Discount</span><span className="tabular-nums">−{money(discountAmount)}</span></p>}
          {loyaltyEnabled && customer && customer.loyaltyPoints > 0 && (
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <label htmlFor="points">Use points <span className="text-stone-500">({customer.loyaltyPoints} available)</span></label>
              <Input id="points" inputMode="numeric" className="w-24 text-right" value={pointsInput} onChange={(e) => setPointsInput(e.target.value)} placeholder="0" />
            </div>
          )}
          {pointsRedeemed > 0 && <p className="mt-1 flex justify-between text-sm"><span>Points</span><span className="tabular-nums">−{money(pointsRedeemed * 100)}</span></p>}
          <p className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-lg font-semibold">
            <span>Total</span><span className="tabular-nums">{money(total)}</span>
          </p>
          {discountLimit !== null && (
            <p className={`mt-1 text-xs ${overLimit ? "text-red-600" : "text-stone-500"}`}>
              Discount {effectivePct.toFixed(1)}% of list price · your limit {discountLimit}%
            </p>
          )}

          <div className="mt-4 space-y-2">
            {payments.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  aria-label="Payment method"
                  value={p.method}
                  onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: e.target.value as Method } : x)))}
                >
                  {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                {payments.length === 1 ? (
                  <span className={`${inputClass} w-full py-2 text-right tabular-nums`}>{money(total)}</span>
                ) : (
                  <Input
                    aria-label="Amount"
                    inputMode="decimal"
                    className="text-right"
                    value={p.amount}
                    onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  />
                )}
                {payments.length > 1 && (
                  <button type="button" className="px-1 text-stone-400 hover:text-red-600" aria-label="Remove payment" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}>✕</button>
                )}
              </div>
            ))}
            {payments.length < 4 && (
              <button
                type="button"
                className="text-sm text-gold-dark hover:underline"
                onClick={() => setPayments((ps) => (ps.length === 1 ? [{ ...ps[0], amount: String(total / 100) }, { method: "BKASH", amount: "" }] : [...ps, { method: "CASH", amount: "" }]))}
              >
                + Split payment
              </button>
            )}
            {payments.length > 1 && remaining !== 0 && (
              <p className="text-sm text-red-600">{remaining > 0 ? `${money(remaining)} still to pay` : `${money(-remaining)} too much`}</p>
            )}
          </div>

          {state.error && <div className="mt-3"><Notice tone="error">{state.error}</Notice></div>}
          <button type="submit" disabled={!canSubmit} className={`${buttonClass("gold")} mt-4 w-full py-3 text-base`}>
            {pending ? "Saving…" : `Save bill · ${money(total)}`}
          </button>
          {!customer && <p className="mt-2 text-center text-xs text-stone-500">Choose a customer first.</p>}
        </Card>
      </div>
    </form>
  );
}

function CustomerPicker({ customer, onChange }: { customer: CustomerHit | null; onChange: (c: CustomerHit | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (customer || q.trim().length < 2) return;
    const t = setTimeout(() => {
      startTransition(async () => setHits(await searchCustomers(q)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, customer]);

  if (customer) {
    return (
      <Card title="Customer" actions={<Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Change</Button>}>
        <p className="text-lg font-medium">
          <Link href={`/customers/${customer.id}`} className="hover:underline" target="_blank">{customer.name}</Link>
        </p>
        <p className="text-sm text-stone-600">
          {displayPhone(customer.phone)} · {customer.lastVisitAt ? `last visit ${formatDate(customer.lastVisitAt)}` : "first visit"}
          {customer.loyaltyPoints > 0 && ` · ${customer.loyaltyPoints} points`}
        </p>
        {customer.notes && <p className="mt-2 rounded-md bg-gold-light/50 px-2 py-1 text-sm"><b>Notes:</b> {customer.notes}</p>}
      </Card>
    );
  }

  const digits = q.replace(/\D/g, "");
  const looksLikePhone = digits.length >= 10;

  return (
    <Card title="Customer">
      <Input
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setError(null);
          if (e.target.value.trim().length < 2) setHits([]);
        }}
        placeholder="Type phone number or name"
        inputMode="search"
      />
      {isPending && <p className="mt-2 text-xs text-stone-500">Searching…</p>}
      {hits.length > 0 && (
        <ul className="mt-2 divide-y divide-stone-100 rounded-md border border-stone-200">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => onChange(h)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-stone-50">
                <span className="font-medium">{h.name}</span>
                <span className="tabular-nums text-stone-500">{displayPhone(h.phone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !isPending && hits.length === 0 && (
        <p className="mt-2 text-sm text-stone-500">No match.</p>
      )}
      {!creating ? (
        <button type="button" className="mt-3 text-sm text-gold-dark hover:underline" onClick={() => setCreating(true)}>
          + New customer
        </button>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input placeholder="Phone" defaultValue={looksLikePhone ? q : ""} id="new-phone" inputMode="tel" />
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const phone = (document.getElementById("new-phone") as HTMLInputElement).value;
                const res = await quickCreateCustomer({ phone, name });
                if (res.error) setError(res.error);
                else if (res.customer) onChange(res.customer);
              })
            }
          >
            Add customer
          </Button>
        </div>
      )}
      {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
    </Card>
  );
}

function CustomPackageBuilder({
  services,
  onAdd,
}: {
  services: Service[];
  onAdd: (c: { name: string; serviceIds: string[]; listPrice: number; price: number; save: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("Custom package");
  const [price, setPrice] = useState("");
  const [save, setSave] = useState(false);
  const listPrice = picked.reduce((s, id) => s + (services.find((x) => x.id === id)?.price ?? 0), 0);
  const pricePoisha = toPoisha(price);

  if (!open) {
    return (
      <button type="button" className="mt-3 text-sm text-gold-dark hover:underline" onClick={() => setOpen(true)}>
        + Build a custom package
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-md border border-dashed border-gold/60 bg-gold-light/20 p-3">
      <p className="mb-2 text-sm font-medium">Custom package</p>
      <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
        {services.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-gold"
              checked={picked.includes(s.id)}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))}
            />
            <span className="flex-1">{s.name}</span>
            <span className="tabular-nums text-stone-500">{money(s.price)}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 grid items-end gap-2 sm:grid-cols-3">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
        <Field label={`Price ৳ (list ${money(listPrice)})`}><Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></Field>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" className="size-4 accent-gold" checked={save} onChange={(e) => setSave(e.target.checked)} />
          Save to catalog
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={picked.length < 2 || !name.trim() || !Number.isFinite(pricePoisha) || pricePoisha < 0}
          onClick={() => {
            onAdd({ name: name.trim(), serviceIds: picked, listPrice, price: pricePoisha, save });
            setPicked([]);
            setPrice("");
            setOpen(false);
          }}
        >
          Add to bill
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
