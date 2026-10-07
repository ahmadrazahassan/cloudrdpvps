"use client";

import { ExternalLink, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ledger/primitives";

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

/**
 * Payment proof viewer: zoom, drag to pan, rotate, open the original. The file comes from a route that
 * checks the staff session and redirects to a 60-second signed link, so no storage URL is ever stored in the page.
 * Keyboard: Z toggles zoom, + / − step it, R is reserved for Reject (see the review panel).
 */
export function ProofViewer({ src, mime, name }: { src: string; mime: string | null; name: string }) {
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const isPdf = mime === "application/pdf";

  const reset = useCallback(() => {
    setZoom(1);
    setTurn(0);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isPdf) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        setZoom((z) => (z > 1 ? 1 : 2));
        setPan({ x: 0, y: 0 });
      } else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(6, z + 0.5));
      else if (e.key === "-") setZoom((z) => Math.max(0.5, z - 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPdf]);

  const btn = "inline-flex h-9 w-9 items-center justify-center rounded-btn text-ink-2 transition-colors hover:bg-black/[0.05] hover:text-ink";

  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        {!isPdf && (
          <>
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(6, z + 0.5))} aria-label="Zoom in">
              <ZoomIn size={18} strokeWidth={1.5} aria-hidden />
            </button>
            <button type="button" className={btn} onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))} aria-label="Zoom out">
              <ZoomOut size={18} strokeWidth={1.5} aria-hidden />
            </button>
            <button type="button" className={btn} onClick={() => setTurn((t) => (t + 90) % 360)} aria-label="Rotate">
              <RotateCw size={18} strokeWidth={1.5} aria-hidden />
            </button>
            <button type="button" onClick={reset} className="ml-1 h-9 rounded-btn px-2 text-[13px] font-medium text-muted hover:text-ink">
              Reset
            </button>
            <span className="num-tabular ml-2 text-[12px] text-muted" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
          </>
        )}
        <a href={src} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex h-9 items-center gap-2 rounded-btn px-2 text-[13px] font-medium text-lav-700 hover:text-lav-900">
          <ExternalLink size={16} strokeWidth={1.5} aria-hidden />
          Open original
        </a>
        {!isPdf && (
          <span className="ml-1 hidden items-center gap-1 text-[12px] text-muted lg:flex" aria-hidden>
            <Kbd>Z</Kbd> zoom
          </span>
        )}
      </div>

      {isPdf ? (
        <iframe src={src} title={`Payment proof: ${name}`} className="h-[560px] w-full rounded-card border border-line-2" />
      ) : (
        <div
          className="relative h-[480px] touch-none select-none overflow-hidden rounded-card border border-line-2"
          style={{ cursor: zoom > 1 ? "grab" : "default" }}
          onPointerDown={(e) => {
            if (zoom <= 1) return;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* A user-supplied screenshot served through our own authenticated route; next/image can't optimise it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Payment proof: ${name}`}
            draggable={false}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain transition-transform duration-150"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${turn}deg)` }}
          />
        </div>
      )}
    </div>
  );
}
