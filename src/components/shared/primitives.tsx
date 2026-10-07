import { Globe } from "lucide-react";
import type { ReactNode } from "react";
import { knownCountry } from "@/content/world";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/utils";

/** `/LABEL` mono eyebrow with a hairline running to the right edge. */
export function Eyebrow({
  children,
  className,
  line = true,
}: {
  children: ReactNode;
  className?: string;
  line?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span className="label-caps shrink-0">/{children}</span>
      {line && <span aria-hidden className="h-px flex-1 bg-line" />}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn(align === "center" && "text-center", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="display-h2 mt-6 max-w-[22ch] text-balance">{title}</h2>
      {description && (
        <p
          className={cn(
            "mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-ink-2",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * A country's flag as a real image file (public/flags, built by scripts/build-flags.mjs), 3:2, sharp on 1x and 2x screens.
 * Decorative unless `name` is given — the country's name is normally printed right beside it.
 * A code we have no artwork for shows a plain globe instead of a broken image.
 */
export function CountryFlag({
  iso2,
  name,
  className,
}: {
  iso2: string;
  name?: string;
  className?: string;
}) {
  const code = iso2.trim().toLowerCase();
  if (!knownCountry(code)) {
    return <Globe aria-hidden size={14} strokeWidth={1.75} className={cn("shrink-0 text-muted", className)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static files, already the right size; the optimizer would only add a hop
    <img
      src={`/flags/w64/${code}.png`}
      srcSet={`/flags/w64/${code}.png 1x, /flags/w128/${code}.png 2x`}
      width={21}
      height={14}
      alt={name ?? ""}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn("h-[14px] w-[21px] shrink-0 rounded-[2px] border border-black/10 object-cover", className)}
    />
  );
}

/** $12 / 30 days */
export function PriceTag({
  cents,
  className,
  big = true,
}: {
  cents: number;
  className?: string;
  big?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span
        className={cn(
          "num-tabular font-display text-ink",
          big ? "text-[40px] font-medium leading-none tracking-[-0.03em]" : "text-xl font-semibold tracking-[-0.018em]",
        )}
      >
        {formatUsd(cents)}
      </span>
      <span className="label-caps normal-case tracking-normal">/ 30 days</span>
    </div>
  );
}

/** Mono key/value rows separated by hairlines. */
export function SpecList({
  rows,
  className,
}: {
  rows: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("text-sm", className)}>
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0"
        >
          <dt className="label-caps">{r.label}</dt>
          <dd className="num-tabular text-right text-[13px] font-medium text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Small status / label tag. Flat by design: transparent fill, 1px coloured
 * outline, 6px radius (never a capsule, never a filled chip).
 */
export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "lavender" | "warn" | "bad" | "ok";
  className?: string;
}) {
  const tones = {
    neutral: "text-ink-2 border-line-2",
    lavender: "text-lav-700 border-lav-300",
    warn: "text-warn border-warn/40",
    bad: "text-bad border-bad/40",
    ok: "text-ok border-ok/40",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-badge border px-2 py-1 text-[11px] font-medium uppercase leading-none tracking-[0.05em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
