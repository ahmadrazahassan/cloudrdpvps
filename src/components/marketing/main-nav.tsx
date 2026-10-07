"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nav } from "@/content/site";
import { cn, formatUsd } from "@/lib/utils";

/**
 * One header cell. Cells run the full height of the bar and are divided by
 * hairlines; the current page (or an open menu) draws a 2px lavender rule over
 * the header's bottom border.
 */
const cellCls =
  "label-caps relative inline-flex h-full items-center gap-1.5 px-4 text-ink-2 transition-colors hover:text-ink " +
  "after:absolute after:inset-x-4 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:bg-lav-500 after:transition-transform after:duration-200 " +
  "hover:after:scale-x-100 data-[active=true]:text-ink data-[active=true]:after:scale-x-100";

function ProductLink({
  href,
  title,
  blurb,
  from,
  art,
  onNavigate,
}: {
  href: string;
  title: string;
  blurb: string;
  from: number | null;
  art: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group flex gap-4 border-b border-transparent p-3 transition-colors hover:border-lav-600"
    >
      <span className="block h-20 w-20 shrink-0 overflow-hidden">{art}</span>
      <span className="flex min-w-0 flex-col justify-center">
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        <span className="mt-1 text-[13px] leading-snug text-muted">{blurb}</span>
        {from !== null && (
          <span className="label-caps mt-2 normal-case tracking-normal text-lav-700">
            From {formatUsd(from)} / 30 days
          </span>
        )}
      </span>
    </Link>
  );
}

const onPath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Desktop navigation. The Products mega-menu follows the W3C "disclosure
 * navigation" pattern: a button with aria-expanded that opens on hover, focus
 * or click, and closes on Escape, outside click, or when focus leaves.
 */
export function MainNav({
  rdpFrom,
  vpsFrom,
  rdpArt,
  vpsArt,
}: {
  rdpFrom: number | null;
  vpsFrom: number | null;
  rdpArt: ReactNode;
  vpsArt: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const itemRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!itemRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const openNow = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 140);
  };

  const onProducts = onPath(pathname, "/rdp") || onPath(pathname, "/vps");
  // Each cell draws its own left hairline; the last one closes the group.
  const divider = "border-l border-line";

  return (
    <nav aria-label="Main" className="hidden h-full xl:block">
      <ul className="flex h-full items-stretch border-r border-line">
        <li
          ref={itemRef}
          className={cn("relative", divider)}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls="products-menu"
            data-active={open || onProducts}
            onClick={() => setOpen((o) => !o)}
            className={cellCls}
          >
            Products
            <ChevronDown
              aria-hidden
              size={14}
              strokeWidth={1.75}
              className={cn("transition-transform duration-200", open && "rotate-180")}
            />
          </button>

          {open && (
            <div className="absolute left-0 top-full pt-px">
              <div
                id="products-menu"
                data-state="open"
                className="nm-viewport w-[680px] origin-top border border-line-2 bg-bg p-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <ProductLink
                    href="/rdp"
                    title="Windows RDP"
                    blurb="A ready-to-use Windows desktop you connect to from anywhere."
                    from={rdpFrom}
                    art={rdpArt}
                    onNavigate={() => setOpen(false)}
                  />
                  <ProductLink
                    href="/vps"
                    title="Windows VPS"
                    blurb="A Windows server with full administrator access for heavier workloads."
                    from={vpsFrom}
                    art={vpsArt}
                    onNavigate={() => setOpen(false)}
                  />
                </div>
              </div>
            </div>
          )}
        </li>

        {nav.main.map((item) => {
          const active = onPath(pathname, item.href);
          return (
            <li key={item.href} className={divider}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-active={active}
                className={cellCls}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
