import Link from "next/link";
import { createAppointment, setAppointmentStatus } from "@/app/actions/appointments";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Button, Card, Empty, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { currentBranchId } from "@/lib/branch";
import { dayRange, dhakaDateString, displayPhone, formatDate } from "@/lib/format";

export const metadata = { title: "Appointments" };

const timeOf = (d: Date) =>
  d.toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit", hour12: true });

const STATUS = {
  BOOKED: <Badge color="blue">Booked</Badge>,
  DONE: <Badge color="green">Done</Badge>,
  CANCELLED: <Badge>Cancelled</Badge>,
  NO_SHOW: <Badge color="red">No-show</Badge>,
};

function shiftDate(ymd: string, days: number) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/appointments">) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.date)) ? String(sp.date) : dhakaDateString();
  const branchId = await currentBranchId(ctx);

  const [appointments, staff] = await Promise.all([
    ctx.db.appointment.findMany({
      where: { startsAt: dayRange(date), branchId },
      orderBy: { startsAt: "asc" },
      include: { staffMember: { select: { name: true } } },
    }),
    ctx.db.staffMember.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const columns = [
    ...staff.map((s) => ({ id: s.id as string | null, name: s.name })),
    { id: null, name: "Anyone" },
  ].filter((c) => c.id || appointments.some((a) => !a.staffMemberId));

  return (
    <>
      <PageHeader
        title="Appointments"
        description={formatDate(new Date(date + "T06:00:00Z"))}
        actions={
          <>
            <LinkButton href={`/appointments?date=${shiftDate(date, -1)}`} variant="secondary">← Previous day</LinkButton>
            <LinkButton href="/appointments" variant="secondary">Today</LinkButton>
            <LinkButton href={`/appointments?date=${shiftDate(date, 1)}`} variant="secondary">Next day →</LinkButton>
          </>
        }
      />

      <Card title="Book" className="mb-6">
        <ActionForm action={createAppointment} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          <Field label="Date"><Input name="date" type="date" defaultValue={date} required /></Field>
          <Field label="Time"><Input name="time" type="time" required step={900} /></Field>
          <Field label="Minutes"><Input name="durationMin" type="number" min={5} max={480} defaultValue={30} required /></Field>
          <Field label="Phone"><Input name="phone" inputMode="tel" placeholder="01XXXXXXXXX" /></Field>
          <Field label="Name"><Input name="name" placeholder="Auto for saved customers" /></Field>
          <Field label="With">
            <Select name="staffMemberId" defaultValue="">
              <option value="">Anyone</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Service"><Input name="service" placeholder="Haircut" /></Field>
          <SubmitButton>Book</SubmitButton>
        </ActionForm>
      </Card>

      {appointments.length === 0 ? (
        <Empty>No appointments on this day.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => {
            const list = appointments.filter((a) => a.staffMemberId === col.id);
            return (
              <div key={col.id ?? "any"}>
                <h3 className="mb-2 font-semibold">{col.name} <span className="text-sm font-normal text-stone-500">{list.length}</span></h3>
                <div className="space-y-2">
                  {list.map((a) => (
                    <div key={a.id} className={`rounded-lg border bg-white p-3 text-sm ${a.status === "BOOKED" ? "border-gold/50" : "border-stone-200 opacity-70"}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold tabular-nums">{timeOf(a.startsAt)}</span>
                        {STATUS[a.status]}
                      </div>
                      <p className="mt-1">
                        {a.customerId ? <Link href={`/customers/${a.customerId}`} className="font-medium hover:underline">{a.name}</Link> : <span className="font-medium">{a.name}</span>}
                        {a.phone && <a href={`tel:${a.phone}`} className="ml-2 text-stone-500 hover:underline">{displayPhone(a.phone)}</a>}
                      </p>
                      <p className="text-stone-600">{a.service ?? "—"} · {a.durationMin} min</p>
                      {a.status === "BOOKED" && (
                        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-stone-100 pt-2">
                          <LinkButton
                            href={a.customerId ? `/billing/new?customer=${a.customerId}` : `/customers/new?next=billing${a.phone ? `&phone=${a.phone.slice(3)}` : ""}`}
                            size="sm"
                            variant="gold"
                          >
                            Start bill
                          </LinkButton>
                          {(["DONE", "NO_SHOW", "CANCELLED"] as const).map((s) => (
                            <ActionForm key={s} action={setAppointmentStatus} showMessage={false} className="flex">
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value={s} />
                              <Button size="sm" variant="ghost">{s === "DONE" ? "Done" : s === "NO_SHOW" ? "No-show" : "Cancel"}</Button>
                            </ActionForm>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {list.length === 0 && <p className="text-sm text-stone-400">Free all day</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
