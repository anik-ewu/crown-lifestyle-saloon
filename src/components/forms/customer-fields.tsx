import { Field, Input, Select, Textarea } from "@/components/ui";
import { displayPhone } from "@/lib/format";

type CustomerLike = {
  phone?: string;
  name?: string;
  address?: string | null;
  gender?: string | null;
  dob?: Date | null;
  notes?: string | null;
};

export function CustomerFields({ c = {} }: { c?: CustomerLike }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Phone *">
        <Input
          name="phone"
          required
          inputMode="tel"
          placeholder="01XXXXXXXXX"
          defaultValue={c.phone ? (c.phone.startsWith("+") ? displayPhone(c.phone) : c.phone) : ""}
        />
      </Field>
      <Field label="Name *">
        <Input name="name" required maxLength={100} defaultValue={c.name ?? ""} />
      </Field>
      <Field label="Address" className="sm:col-span-2">
        <Input name="address" maxLength={300} defaultValue={c.address ?? ""} />
      </Field>
      <Field label="Gender">
        <Select name="gender" defaultValue={c.gender ?? ""}>
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Date of birth">
        <Input name="dob" type="date" defaultValue={c.dob ? c.dob.toISOString().slice(0, 10) : ""} />
      </Field>
      <Field label="Notes" hint="Allergies, preferred stylist, hair colour formula…" className="sm:col-span-2">
        <Textarea name="notes" maxLength={1000} defaultValue={c.notes ?? ""} />
      </Field>
    </div>
  );
}
