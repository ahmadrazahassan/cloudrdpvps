import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "dark"
  | "ghost"
  | "ghost-inverse"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  dark: "btn-dark",
  ghost: "btn-ghost",
  "ghost-inverse": "btn-ghost-inverse",
  danger: "btn-danger",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "btn",
    variantClass[variant],
    size === "sm" && "btn-sm",
    size === "lg" && "btn-lg",
    className,
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Glossy button. `loading` keeps the width stable and swaps in a spinner. */
export function Button({
  variant,
  size,
  className,
  loading,
  children,
  disabled,
  type = "button",
  ...rest
}: CommonProps & { loading?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn-spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** Same look, rendered as a Next.js link. */
export function ButtonLink({
  variant,
  size,
  className,
  disabled,
  children,
  ...rest
}: CommonProps & { disabled?: boolean } & ComponentProps<typeof Link>) {
  return (
    <Link
      className={buttonClasses({ variant, size, className })}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}
