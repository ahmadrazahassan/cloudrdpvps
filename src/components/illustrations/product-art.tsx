import { WINDOWS_BLUE } from "@/components/brand/windows-logo";
import {
  Art,
  INK,
  IsoBox,
  LAV,
  Leader,
  OnFront,
  OnSide,
  OnTop,
  PAPER,
  TONE,
  TONE_2,
  dash,
  line,
} from "./iso";

/** The Windows logo as drawn inside the illustrations: four panes in Windows blue, `size` units wide, top-left at (x, y). */
function WinMark({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${size / 24})`}
      d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"
      fill={WINDOWS_BLUE}
      stroke="none"
    />
  );
}

/* ------------------------------------------------------------------
   product-rdp — isometric monitor with a windowed Windows desktop:
   the Windows logo on the Start button and as the desktop mark.
------------------------------------------------------------------- */
export function ProductRdp({ className }: { className?: string }) {
  const SW = 300; // screen width
  const SH = 190; // screen height
  const SZ = 92; // screen bottom z
  return (
    <Art viewBox="0 0 600 600" className={className} title="Desktop monitor showing remote Windows desktop windows">
      <g transform="translate(166 338) scale(1.05)">
        {/* base + neck */}
        <IsoBox x={100} y={-64} z={0} w={104} d={94} h={8} />
        <IsoBox x={138} y={-24} z={8} w={30} d={16} h={SZ - 8} />

        {/* screen slab */}
        <IsoBox x={0} y={0} z={SZ} w={SW} d={16} h={SH} front={PAPER} side={TONE_2} />
        <OnFront x={0} y={0} z={SZ} d={16} h={SH}>
          {/* inner display */}
          <rect x={9} y={9} width={SW - 18} height={SH - 18} rx={4} fill={TONE} {...line} strokeWidth={1.2} />
          {/* back window */}
          <rect x={64} y={24} width={168} height={92} rx={4} fill={PAPER} {...line} strokeWidth={1.2} />
          <line x1={64} y1={38} x2={232} y2={38} {...line} strokeWidth={1.2} />
          <line x1={76} y1={56} x2={180} y2={56} {...line} strokeWidth={1.1} />
          <line x1={76} y1={70} x2={150} y2={70} {...line} strokeWidth={1.1} />
          {/* mid window */}
          <rect x={24} y={54} width={140} height={86} rx={4} fill={PAPER} {...line} strokeWidth={1.2} />
          <line x1={24} y1={68} x2={164} y2={68} {...line} strokeWidth={1.2} />
          <rect x={36} y={80} width={52} height={44} rx={2} {...line} strokeWidth={1.1} fill={TONE} />
          <line x1={98} y1={86} x2={152} y2={86} {...line} strokeWidth={1.1} />
          <line x1={98} y1={100} x2={140} y2={100} {...line} strokeWidth={1.1} />
          {/* front window — lavender title bar (single accent) */}
          <rect x={112} y={84} width={168} height={74} rx={4} fill={PAPER} {...line} strokeWidth={1.2} />
          <path d="M112 98 V88 a4 4 0 0 1 4 -4 H276 a4 4 0 0 1 4 4 V98 Z" fill={LAV} stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <line x1={126} y1={116} x2={246} y2={116} {...line} strokeWidth={1.1} />
          <line x1={126} y1={130} x2={216} y2={130} {...line} strokeWidth={1.1} />
          <line x1={126} y1={144} x2={190} y2={144} {...line} strokeWidth={1.1} />
          {/* desktop mark, top right */}
          <WinMark x={240} y={16} size={42} />
          {/* taskbar: Start button, then app icons */}
          <rect x={9} y={SH - 30} width={SW - 18} height={21} fill={PAPER} {...line} strokeWidth={1.2} />
          <WinMark x={16} y={SH - 25} size={11} />
          {[40, 62, 84, 106, 128, 150].map((u) => (
            <rect key={u} x={u} y={SH - 25} width={12} height={11} rx={2} {...line} strokeWidth={1.1} fill={TONE} />
          ))}
        </OnFront>

        {/* keyboard + mouse */}
        <IsoBox x={34} y={78} z={0} w={210} d={64} h={7} />
        <OnTop x={34} y={78} z={0} h={7}>
          {[0, 1, 2, 3].map((r) =>
            Array.from({ length: 14 }, (_, c) => (
              <rect
                key={`${r}-${c}`}
                x={8 + c * 14.2}
                y={7 + r * 13.6}
                width={11}
                height={10}
                rx={1.5}
                fill={PAPER}
                {...line}
                strokeWidth={1}
              />
            )),
          )}
        </OnTop>
        <IsoBox x={262} y={92} z={0} w={26} d={40} h={9} />

        {/* remote-connection arc */}
        <path d="M252 -88 C318 -150 352 -70 312 6" {...dash} />
        <path d="M303 -8 L312 8 L296 6" {...line} />
      </g>
    </Art>
  );
}

/* ------------------------------------------------------------------
   product-vps — stack of four server slabs with guide lines.
------------------------------------------------------------------- */
export function ProductVps({ className }: { className?: string }) {
  const W = 300;
  const D = 180;
  const H = 34;
  const zs = [0, 72, 144, 240]; // top slab lifted a little further
  return (
    <Art viewBox="0 0 600 600" className={className} title="Stack of virtual server layers">
      <g transform="translate(252 312) scale(1.02)">
        {/* guide lines between slabs */}
        {[
          [0, D],
          [W, D],
          [W, 0],
        ].map(([x, y], i) => (
          <Leader key={i} x={x!} y={y!} z1={0} z2={zs[3]! + H} />
        ))}
        {zs.map((z, i) => (
          <g key={z}>
            <IsoBox x={0} y={0} z={z} w={W} d={D} h={H} />
            <OnFront x={0} y={0} z={z} d={D} h={H}>
              {/* the top slab carries the Windows logo where the first drive bay would be */}
              {i === 3 && <WinMark x={15} y={5} size={24} />}
              {[0, 1, 2, 3].map((k) =>
                i === 3 && k === 0 ? null : (
                  <rect key={k} x={14 + k * 38} y={8} width={30} height={18} rx={2} fill={PAPER} {...line} strokeWidth={1.2} />
                ),
              )}
              <line x1={176} y1={17} x2={232} y2={17} {...line} strokeWidth={1.2} />
              {/* LED cluster — lavender accent only on the 2nd slab */}
              <circle cx={252} cy={17} r={4} fill={i === 1 ? LAV : INK} stroke="none" />
              <circle cx={268} cy={17} r={4} fill={INK} stroke="none" />
              <circle cx={284} cy={17} r={4} fill={PAPER} {...line} strokeWidth={1.2} />
            </OnFront>
            <OnSide x={0} y={0} z={z} w={W} d={D} h={H}>
              {[18, 36, 54, 72].map((u) => (
                <line key={u} x1={u} y1={9} x2={u} y2={25} {...line} strokeWidth={1.1} />
              ))}
            </OnSide>
          </g>
        ))}
      </g>
    </Art>
  );
}

/* ------------------------------------------------------------------
   datacenter-aisle — one-point perspective aisle between server racks.
------------------------------------------------------------------- */
export function DatacenterAisle({ className }: { className?: string }) {
  const VP = { x: 600, y: 330 };
  const scale = (k: number) => 1 / (1 + 0.55 * k);
  const racks = 7;
  const top = (s: number) => VP.y - 300 * s;
  const bottom = (s: number) => VP.y + 330 * s;
  const leftX = (s: number) => VP.x - 560 * s;
  const rightX = (s: number) => VP.x + 560 * s;
  const ceil = (s: number) => VP.y - 322 * s;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const ks = Array.from({ length: racks }, (_, i) => i);
  const UNITS = 11;

  const rackFace = (side: "l" | "r", k: number) => {
    const s0 = scale(k);
    const s1 = scale(k + 1);
    const X = side === "l" ? leftX : rightX;
    const x0 = X(s0);
    const x1 = X(s1);
    const poly = `${x0},${top(s0)} ${x1},${top(s1)} ${x1},${bottom(s1)} ${x0},${bottom(s0)}`;
    return (
      <g key={`${side}${k}`}>
        <polygon points={poly} fill={k % 2 ? PAPER : "#F6F6F8"} {...line} />
        {Array.from({ length: UNITS - 1 }, (_, u) => {
          const f = (u + 1) / UNITS;
          const y0 = lerp(top(s0), bottom(s0), f);
          const y1 = lerp(top(s1), bottom(s1), f);
          // handle / port tick
          const hx0 = lerp(x0, x1, 0.18);
          const hx1 = lerp(x0, x1, 0.55);
          const hy0 = lerp(y0, y1, 0.18);
          const hy1 = lerp(y0, y1, 0.55);
          return (
            <g key={u}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} {...line} strokeWidth={1} />
              <line x1={hx0} y1={hy0 - 4 * s0} x2={hx1} y2={hy1 - 4 * s1} {...line} strokeWidth={1} />
            </g>
          );
        })}
      </g>
    );
  };

  const rungs = Array.from({ length: 14 }, (_, i) => scale(i * 0.5));

  return (
    <Art viewBox="0 0 1200 800" className={className} title="Data centre aisle between two rows of server racks">
      <defs>
        <clipPath id="aisle-floor">
          <polygon points={`0,800 1200,800 1200,${bottom(1)} ${rightX(1)},${bottom(1)} ${VP.x},${VP.y} ${leftX(1)},${bottom(1)} 0,${bottom(1)}`} />
        </clipPath>
      </defs>

      {/* floor tiles */}
      <g clipPath="url(#aisle-floor)">
        {Array.from({ length: 15 }, (_, j) => {
          const bx = VP.x + (j - 7) * 150;
          return <line key={j} x1={VP.x} y1={VP.y} x2={bx} y2={800} {...line} strokeWidth={1} stroke="#C7C7CF" />;
        })}
        {rungs.map((s, i) => (
          <line key={i} x1={0} y1={bottom(s)} x2={1200} y2={bottom(s)} {...line} strokeWidth={1} stroke="#C7C7CF" />
        ))}
      </g>

      {/* racks, far → near so near ones overlap */}
      {[...ks].reverse().map((k) => rackFace("l", k))}
      {[...ks].reverse().map((k) => rackFace("r", k))}

      {/* ceiling cable tray */}
      {[-1, 1].map((sd) => (
        <line key={sd} x1={VP.x + sd * 130} y1={ceil(1)} x2={VP.x + sd * 130 * scale(7)} y2={ceil(scale(7))} {...line} />
      ))}
      {rungs.map((s, i) => (
        <line key={i} x1={VP.x - 130 * s} y1={ceil(s)} x2={VP.x + 130 * s} y2={ceil(s)} {...line} strokeWidth={1.1} />
      ))}
      {/* single lavender accent: the cable run */}
      <line x1={VP.x - 36} y1={ceil(1)} x2={VP.x - 36 * scale(7)} y2={ceil(scale(7))} stroke={LAV} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </Art>
  );
}
