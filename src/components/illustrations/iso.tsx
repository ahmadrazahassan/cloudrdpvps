import type { ReactNode } from "react";

/* ------------------------------------------------------------------
   Isometric drawing helpers used by every code-built illustration.
   Style = "Family A" from prompts/05: near-black monoline, flat light-grey
   tone on shaded faces, ONE lavender accent per image, no gradients.
------------------------------------------------------------------- */

export const INK = "#121214";
export const LAV = "#9468E0";
export const LAV_SOFT = "#DCCDF8";
export const TONE = "#E6E6EA";
export const TONE_2 = "#D9D9DF";
export const PAPER = "#FFFFFF";

const C = Math.cos(Math.PI / 6); // 0.866
const S = 0.5;

/** iso projection: x → right-down, y → left-down, z → up */
export function P(x: number, y: number, z: number): [number, number] {
  return [(x - y) * C, (x + y) * S - z];
}

export const pts = (list: [number, number][]) =>
  list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

/** Shared stroke style. Non-scaling so line weight stays consistent at every size. */
export const line = {
  stroke: INK,
  strokeWidth: 1.6,
  strokeLinejoin: "round",
  strokeLinecap: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

export const dash = {
  ...line,
  strokeWidth: 1.2,
  strokeDasharray: "2 5",
} as const;

interface BoxProps {
  x: number;
  y: number;
  z: number;
  /** extent along x / y / z */
  w: number;
  d: number;
  h: number;
  top?: string;
  front?: string; // y = y+d face (visible lower-left)
  side?: string; // x = x+w face (visible lower-right)
  noTop?: boolean;
  children?: ReactNode;
}

/** An isometric cuboid with three visible faces. */
export function IsoBox({
  x,
  y,
  z,
  w,
  d,
  h,
  top = PAPER,
  front = TONE,
  side = TONE_2,
  noTop,
}: BoxProps) {
  const t = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const f = [P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)];
  const s = [P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)];
  return (
    <g {...line}>
      <polygon points={pts(f)} fill={front} />
      <polygon points={pts(s)} fill={side} />
      {!noTop && <polygon points={pts(t)} fill={top} />}
    </g>
  );
}

/** Place 2D content (origin top-left, y down) onto the FRONT face of a box. */
export function OnFront({
  x,
  y,
  z,
  d,
  h,
  children,
}: {
  x: number;
  y: number;
  z: number;
  d: number;
  h: number;
  children: ReactNode;
}) {
  const [e, f] = P(x, y + d, z + h);
  return <g transform={`matrix(${C} ${S} 0 1 ${e.toFixed(2)} ${f.toFixed(2)})`}>{children}</g>;
}

/** Place 2D content onto the SIDE (x = x+w) face of a box. */
export function OnSide({
  x,
  y,
  z,
  w,
  d,
  h,
  children,
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  children: ReactNode;
}) {
  const [e, f] = P(x + w, y + d, z + h);
  return <g transform={`matrix(${C} ${-S} 0 1 ${e.toFixed(2)} ${f.toFixed(2)})`}>{children}</g>;
}

/** Place 2D content onto a TOP face: u along +x, v along +y (viewed from above-front). */
export function OnTop({
  x,
  y,
  z,
  h,
  children,
}: {
  x: number;
  y: number;
  z: number;
  h: number;
  children: ReactNode;
}) {
  const [e, f] = P(x, y, z + h);
  return <g transform={`matrix(${C} ${S} ${-C} ${S} ${e.toFixed(2)} ${f.toFixed(2)})`}>{children}</g>;
}

/** A dotted vertical leader between two heights at the same x,y. */
export function Leader({
  x,
  y,
  z1,
  z2,
}: {
  x: number;
  y: number;
  z1: number;
  z2: number;
}) {
  const [a, b] = P(x, y, z1);
  const [c, d] = P(x, y, z2);
  return <line x1={a} y1={b} x2={c} y2={d} {...dash} />;
}

/** Dotted leader between two arbitrary iso points. */
export function Leader3({
  from,
  to,
}: {
  from: [number, number, number];
  to: [number, number, number];
}) {
  const [a, b] = P(...from);
  const [c, d] = P(...to);
  return <line x1={a} y1={b} x2={c} y2={d} {...dash} />;
}

/** Wrapper that gives every illustration the same SVG props. */
export function Art({
  viewBox,
  className,
  children,
  title,
}: {
  viewBox: string;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}
