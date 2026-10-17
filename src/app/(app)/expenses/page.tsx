import { createExpense, deleteExpense } from "@/app/actions/expenses";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button, Card, Empty, Field, Input, PageHeader, Select, Stat, Table } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { dhakaDateString, money, monthRange } from "@/lib/format";
import { salesSummary } from "@/lib/reports";

export const metadata = { title: "Expenses" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CATEGORIES = ["Rent", "Salaries", "Products & supplies", "Electricity", "Water & gas", "Internet & phone", "Repairs", "Marketing", "Other"];

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const today = dhakaDateString();
  const [ty, tm] = today.split("-").map(Number);
  const year = Number(sp.y) || ty;
  const month = Math.min(12, Math.max(1, Number(sp.m) || tm));
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = new Date(`${year}-${pad(month)}-01T00:00:00Z`);
  const to = new Date(Date.UTC(year, month, 1));

  const [expenses, sales] = await Promise.all([
    ctx.db.expense.findMany({ where: { date: { gte: from, lt: to } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { branch: { select: { name: true } } } }),
    salesSummary(ctx, monthRange(year, month)),
  ]);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = [...expenses.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader title="Expenses" description="Rent, salaries, supplies and other costs. Used for the profit figure on the dashboard." />
      <form className="mb-4 flex gap-2">
        <Select name="m" defaultValue={month} className="w-auto" aria-label="Month">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
        <Select name="y" defaultValue={year} className="w-auto" aria-label="Year">{[ty, ty - 1, ty - 2].map((y) => <option key={y} value={y}>{y}</option>)}</Select>
        <Button variant="secondary">Show</Button>
      </form>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label={`Sales ${MONTHS[month - 1]}`} value={money(sales.revenue)} />
        <Stat label="Expenses" value={money(total)} />
        <Stat label="Profit" value={money(sales.revenue - total)} />
      </div>

      <Card title="Add expense" className="mb-6">
        <ActionForm action={createExpense} resetOnSuccess className="grid items-end gap-3 sm:grid-cols-5">
          <Field label="Date"><Input name="date" type="date" defaultValue={today} required /></Field>
          <Field label="Category">
            <Input name="category" list="expense-categories" required />
            <datalist id="expense-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Amount (৳)"><Input name="amount" inputMode="decimal" required /></Field>
          <Field label="Note"><Input name="note" /></Field>
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Card>

      {expenses.length === 0 ? (
        <Empty>No expenses this month.</Empty>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Table>
              <thead><tr><th>Date</th><th>Category</th><th>Note</th><th className="text-right">Amount</th><th className="w-24"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{e.date.toISOString().slice(0, 10)}</td>
                    <td>{e.category}</td>
                    <td className="text-stone-600">{e.note}</td>
                    <td className="text-right tabular-nums">{money(e.amount)}</td>
                    <td className="text-right">
                      <ActionForm action={deleteExpense} confirm="Delete this expense?" showMessage={false} className="flex justify-end">
                        <input type="hidden" name="id" value={e.id} />
                        <SubmitButton variant="danger" size="sm">Delete</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Card title="By category">
            <dl className="space-y-1 text-sm">
              {byCategory.map(([c, v]) => (
                <div key={c} className="flex justify-between"><dt>{c}</dt><dd className="tabular-nums">{money(v)}</dd></div>
              ))}
            </dl>
          </Card>
        </div>
      )}
    </>
  );
}
