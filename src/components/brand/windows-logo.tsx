import { cn } from "@/lib/utils";

/** Microsoft's Windows blue. The mark keeps its own colour wherever it appears; it is the one brand colour on the site. */
export const WINDOWS_BLUE = "#0078D4";

/**
 * The Windows logo (four panes). Use it wherever the operating system is named, so "Windows Server" reads
 * as the real thing at a glance. It is a bare mark — never put it on a chip or a filled square.
 * Decorative by default (the words next to it carry the meaning); pass `title` to make it stand alone.
 */
export function WindowsLogo({ size = 16, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={WINDOWS_BLUE}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
    </svg>
  );
}

/** The mark followed by a label — "Windows Server", "Windows RDP". */
export function WindowsOs({
  label = "Windows Server",
  size = 14,
  className,
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <WindowsLogo size={size} />
      {label}
    </span>
  );
}
