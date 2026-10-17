"use client";

import { useActionState, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action";
import { buttonClass, Notice, type ButtonVariant } from "@/components/ui";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Form bound to a server action returning ActionState. Shows the error or
 * success message, and resets the inputs after success when `resetOnSuccess`.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  confirm,
  showMessage = true,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  showMessage?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state.key, state.ok, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {showMessage && state.error && (
        <div className="col-span-full mt-3 basis-full">
          <Notice tone="error">{state.error}</Notice>
        </div>
      )}
      {showMessage && state.ok && state.message && (
        <div className="col-span-full mt-3 basis-full">
          <Notice tone="success">
            {state.message}
            {state.secret && (
              <span className="mt-1 block">
                <code className="rounded bg-white px-2 py-1 font-mono text-base font-semibold select-all">{state.secret}</code>
                <span className="mt-1 block text-xs">Shown only once. Copy it now.</span>
              </span>
            )}
          </Notice>
        </div>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={`${buttonClass(variant, size)} ${className ?? ""}`}
      {...props}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
