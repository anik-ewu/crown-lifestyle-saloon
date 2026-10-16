import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-stone-600">That page or record doesn&apos;t exist.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-gold-dark hover:underline">Go home</Link>
      </div>
    </main>
  );
}
