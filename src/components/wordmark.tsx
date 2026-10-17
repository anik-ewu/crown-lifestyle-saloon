import { APP_NAME } from "@/lib/brand";

/** Product mark for pages outside any salon (sign-in, sign-up). */
export function Wordmark({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand.svg" alt="" width={56} height={56} className="rounded-xl" />
      <h1 className="mt-3 text-xl font-semibold text-gold-light">{APP_NAME}</h1>
      {subtitle && <p className="text-sm text-stone-400">{subtitle}</p>}
    </div>
  );
}
