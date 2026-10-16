"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-stone-600">
          The action didn&apos;t finish. Nothing was saved unless you see it on the page after retrying.
          {error.digest && <span className="mt-1 block text-xs text-stone-400">Reference: {error.digest}</span>}
        </p>
        <button onClick={reset} className="mt-4 rounded-md bg-ink px-4 py-2 text-sm text-white">Try again</button>
      </div>
    </main>
  );
}
