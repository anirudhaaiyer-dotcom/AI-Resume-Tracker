"use client";

import { useFormStatus } from "react-dom";

// Disables itself while the server action runs, so one click = one action.
export function Submit({
  children,
  pendingText,
  variant = "primary",
  name,
  value,
  formAction,
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary" | "danger";
  name?: string;
  value?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  const style =
    variant === "primary"
      ? "bg-accent text-accent-ink border-accent"
      : variant === "danger"
        ? "border-danger text-danger"
        : "border-line text-ink";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      disabled={pending}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${style}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
