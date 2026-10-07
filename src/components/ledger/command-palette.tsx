"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "./primitives";

export interface PaletteItem {
  id: string;
  label: string;
  href: string;
  group: string;
  /** Small muted text after the label (an email, a status…). */
  hint?: string;
  /** Extra words that should match when searching. */
  keywords?: string;
  /** A single letter: pressing `g` then this letter jumps here from anywhere. */
  goto?: string;
}

/** A Server Action made with `action({ schema: z.object({ q }) })`: takes `{ q }`, answers with an ActionResult of items. */
export type PaletteSearch = (input: { q: string }) => Promise<{ ok: true; data: PaletteItem[] } | { ok: false }>;

const OPEN_EVENT = "ledger:palette-open";
export const openPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

const noopSubscribe = () => () => {};
const isMacSnapshot = () => /Mac|iPhone|iPad/i.test(navigator.userAgent);

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

function matches(item: PaletteItem, q: string) {
  const hay = `${item.label} ${item.group} ${item.keywords ?? ""} ${item.hint ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => hay.includes(tok));
}

/** The button shown in a top bar: looks like a search field, opens the palette. */
export function PaletteButton({ placeholder = "Search or jump to…", className }: { placeholder?: string; className?: string }) {
  const mac = useSyncExternalStore(noopSubscribe, isMacSnapshot, () => false);
  return (
    <button
      type="button"
      onClick={openPalette}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-card border border-line-2 px-3 text-left text-[14px] text-muted transition-colors hover:border-muted",
        className,
      )}
    >
      <Search size={16} strokeWidth={1.5} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{placeholder}</span>
      <span className="hidden items-center gap-1 sm:flex" aria-hidden>
        <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
      <span className="sr-only">Shortcut: {mac ? "Command" : "Control"} K, or the slash key</span>
    </button>
  );
}

/**
 * Command palette + keyboard layer, shared by the dashboard and the console.
 *   ⌘K / Ctrl K / "/"   open        ↑ ↓ Enter   choose        Esc   close
 *   g then a letter      jump to a page (see `goto` on the items)
 *   j / k                move between rows that carry `data-row-link`
 * `search` is a Server Action that returns live matches (orders, customers…) for what was typed.
 */
export function CommandPalette({
  items,
  search,
  placeholder = "Type a page, order number, email or IP…",
}: {
  items: PaletteItem[];
  search?: PaletteSearch;
  placeholder?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<{ q: string; items: PaletteItem[] }>({ q: "", items: [] });
  const listId = useId();
  const ticket = useRef(0);
  const pendingG = useRef(0);

  const jump = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  // global keys
  useEffect(() => {
    const onOpen = () => {
      setQuery("");
      setActive(0);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
        return;
      }
      if (mod || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[role='dialog']")) return; // another dialog owns the keyboard

      if (e.key === "/") {
        e.preventDefault();
        onOpen();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        onOpen();
        return;
      }
      if (Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        const target = items.find((i) => i.goto === e.key.toLowerCase());
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (e.key === "g") {
        pendingG.current = Date.now();
        return;
      }
      if (e.key === "j" || e.key === "k") {
        const links = Array.from(document.querySelectorAll<HTMLElement>("a[data-row-link]"));
        if (links.length === 0) return;
        const at = links.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "j" ? Math.min(links.length - 1, at + 1) : Math.max(0, at === -1 ? 0 : at - 1);
        e.preventDefault();
        links[next]?.focus();
        links[next]?.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [items, router]);

  // live results, debounced; stale responses are dropped
  useEffect(() => {
    const q = query.trim();
    if (!open || !search || q.length < 2) return;
    const mine = ++ticket.current;
    const timer = window.setTimeout(async () => {
      try {
        const found = await search({ q });
        if (ticket.current === mine) setRemote({ q, items: found.ok ? found.data : [] });
      } catch {
        if (ticket.current === mine) setRemote({ q, items: [] });
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [open, query, search]);

  const trimmed = query.trim();
  const visible = useMemo(() => {
    const local = trimmed ? items.filter((i) => matches(i, trimmed)) : items;
    const live = remote.q === trimmed && trimmed.length >= 2 ? remote.items : [];
    return [...live, ...local].slice(0, 40);
  }, [items, remote, trimmed]);

  const groups = useMemo(() => {
    const out: { name: string; rows: { item: PaletteItem; index: number }[] }[] = [];
    visible.forEach((item, index) => {
      let g = out.find((x) => x.name === item.group);
      if (!g) out.push((g = { name: item.group, rows: [] }));
      g.rows.push({ item, index });
    });
    return out;
  }, [visible]);

  const safeActive = Math.min(active, Math.max(0, visible.length - 1));

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((safeActive + 1) % Math.max(1, visible.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((safeActive - 1 + visible.length) % Math.max(1, visible.length));
    } else if (e.key === "Enter") {
      const row = visible[safeActive];
      if (row) {
        e.preventDefault();
        jump(row.href);
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-ink/30 data-[state=open]:animate-[fade-in_0.15s_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-[90] w-[calc(100%-24px)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-panel border border-black/[0.06] bg-surface shadow-2 data-[state=open]:animate-[palette-in_0.16s_ease-out]"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search size={18} strokeWidth={1.5} aria-hidden className="text-muted" />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={visible[safeActive] ? `${listId}-${safeActive}` : undefined}
              aria-label="Search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              placeholder={placeholder}
              className="h-14 w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
            />
            <Kbd>Esc</Kbd>
          </div>

          <div id={listId} role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto py-2">
            {visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-[14px] text-muted">
                {search && trimmed.length >= 2 && remote.q !== trimmed ? "Searching…" : "Nothing matches that."}
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.name} role="group" aria-label={g.name} className="py-1">
                  <p aria-hidden className="label-caps px-4 pb-1 pt-2">
                    {g.name}
                  </p>
                  {g.rows.map(({ item, index }) => (
                    <div
                      key={item.id}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === safeActive}
                      data-active={index === safeActive || undefined}
                      onMouseMove={() => index !== safeActive && setActive(index)}
                      onClick={() => jump(item.href)}
                      className="ledger-row mx-2 flex min-h-[42px] cursor-pointer items-center gap-3 rounded-card px-3 text-[14px] text-ink"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                      {item.hint && <span className="hidden max-w-[45%] truncate text-[13px] text-muted sm:block">{item.hint}</span>}
                      {item.goto && !trimmed && (
                        <span aria-hidden className="flex items-center gap-1">
                          <Kbd>G</Kbd>
                          <Kbd>{item.goto.toUpperCase()}</Kbd>
                        </span>
                      )}
                      {index === safeActive && <CornerDownLeft size={14} strokeWidth={1.5} aria-hidden className="text-muted" />}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] text-muted" aria-hidden>
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> open
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>G</Kbd> then a letter jumps
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>J</Kbd>
              <Kbd>K</Kbd> rows
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
