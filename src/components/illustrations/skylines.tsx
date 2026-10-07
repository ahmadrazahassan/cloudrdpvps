import type { ReactNode } from "react";
import { LAV } from "./iso";

/* ------------------------------------------------------------------
   "Family B" — lavender scan-line skylines for the locations that have artwork.
   Each silhouette is drawn in white inside an SVG mask; the mask reveals a
   pattern of thin horizontal lavender lines. Flat colour, no gradients.
------------------------------------------------------------------- */

const W = 1200;
const H = 800;

function ScanArt({
  id,
  title,
  className,
  viewBox = `0 0 ${W} ${H}`,
  bold,
  thin,
  cut,
}: {
  id: string;
  title: string;
  className?: string;
  /** crop window — must keep a 3:2 aspect ratio */
  viewBox?: string;
  /** primary silhouette (white shapes) */
  bold: ReactNode;
  /** distant / secondary silhouette, drawn with finer lines */
  thin?: ReactNode;
  /** cut-outs (black shapes) removed from the bold silhouette */
  cut?: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMax slice"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={`${id}-bold`} width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="8" fill={LAV} />
        </pattern>
        <pattern id={`${id}-thin`} width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="3.4" fill={LAV} />
        </pattern>
        <mask id={`${id}-mb`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill="#000" />
          <g fill="#fff" stroke="#fff">
            {bold}
          </g>
          <g fill="#000" stroke="#000">
            {cut}
          </g>
        </mask>
        <mask id={`${id}-mt`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill="#000" />
          <g fill="#fff" stroke="#fff">
            {thin}
          </g>
          {/* keep distant layer from showing through the main silhouette */}
          <g fill="#000" stroke="#000">
            {bold}
          </g>
        </mask>
      </defs>
      {thin && <rect width={W} height={H} fill={`url(#${id}-thin)`} mask={`url(#${id}-mt)`} />}
      <rect width={W} height={H} fill={`url(#${id}-bold)`} mask={`url(#${id}-mb)`} />
    </svg>
  );
}

const r = (x: number, y: number, w: number, h = H - y) => <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} />;
const dome = (cx: number, base: number, rad: number) => (
  <path key={`d${cx}-${base}`} d={`M${cx - rad} ${base} A${rad} ${rad} 0 0 1 ${cx + rad} ${base} Z`} />
);
const slit = (x: number, y: number, h: number, w = 6) => <rect key={`s${x}-${y}`} x={x} y={y} width={w} height={h} />;

/** Distant low-rise layer for visual depth */
const farTown = (seed: number) => {
  const out: ReactNode[] = [];
  let x = -10;
  let i = seed;
  while (x < W) {
    i = (i * 9301 + 49297) % 233280;
    const w = 34 + (i % 50);
    const h = 120 + ((i >> 3) % 150);
    out.push(r(x, H - h, w));
    x += w + 6;
  }
  return out;
};

/* ---------------- India — Gateway of India & Mumbai ---------------- */
export function SkylineIn({ className }: { className?: string }) {
  return (
    <ScanArt
      id="sk-in"
      viewBox="200 200 900 600"
      title="Gateway of India and Mumbai skyline, India"
      className={className}
      thin={farTown(7)}
      bold={
        <>
          {/* Gateway of India */}
          {r(250, 540, 300)}
          {dome(400, 540, 52)}
          {r(396, 456, 8, 32)}
          {r(252, 496, 28, 44)}
          {dome(266, 496, 14)}
          {r(520, 496, 28, 44)}
          {dome(534, 496, 14)}
          {/* Taj Mahal Palace */}
          {r(600, 580, 150)}
          {dome(640, 580, 32)}
          {dome(710, 580, 32)}
          {r(664, 516, 22, 64)}
          {dome(675, 516, 16)}
          {/* modern towers */}
          {r(790, 430, 70)}
          {r(870, 360, 56)}
          <polygon points="870,360 898,320 926,360" />
          {r(940, 480, 70)}
          {r(1020, 410, 78)}
          {r(1108, 540, 60)}
        </>
      }
      cut={
        <>
          <path d="M344 800 V652 A56 56 0 0 1 456 652 V800 Z" />
          {[560, 600, 640].map((y) => slit(262, y, 5, 70))}
          {[560, 600, 640].map((y) => slit(468, y, 5, 70))}
          {slit(824, 450, 340, 4)}
          {slit(900, 380, 420, 4)}
          {slit(972, 500, 300, 4)}
          {slit(1058, 430, 370, 4)}
          {[640, 690].map((y) => slit(620, y, 5, 110))}
        </>
      }
    />
  );
}

/* ---------------- Bangladesh — Jatiya Sangsad Bhaban ---------------- */
export function SkylineBd({ className }: { className?: string }) {
  return (
    <ScanArt
      id="sk-bd"
      viewBox="220 293 760 507"
      title="National Parliament House and Dhaka skyline, Bangladesh"
      className={className}
      thin={farTown(3)}
      bold={
        <>
          {/* central octagonal volume */}
          <polygon points="430,800 430,540 484,486 716,486 770,540 770,800" />
          {r(330, 610, 100)}
          {r(770, 610, 100)}
          {r(560, 440, 80, 46)}
          {/* flanking towers */}
          {r(110, 500, 80)}
          {r(200, 590, 70)}
          {r(900, 540, 62)}
          {r(972, 450, 80)}
          {r(1062, 570, 70)}
        </>
      }
      cut={
        <>
          <circle cx="600" cy="600" r="74" />
          <polygon points="456,800 456,690 520,800" />
          <polygon points="744,800 744,690 680,800" />
          <polygon points="352,800 352,700 410,800" />
          <circle cx="820" cy="700" r="32" />
          <circle cx="600" cy="520" r="18" />
          {slit(134, 520, 260, 4)}
          {slit(996, 470, 320, 4)}
        </>
      }
    />
  );
}

/* ---------------- USA — Manhattan skyline ---------------- */
export function SkylineUs({ className }: { className?: string }) {
  return (
    <ScanArt
      id="sk-us"
      viewBox="60 80 1080 720"
      title="Manhattan skyline, USA"
      className={className}
      thin={farTown(11)}
      bold={
        <>
          {/* Empire State Building (stepped) */}
          {r(560, 470, 120)}
          {r(578, 410, 84)}
          {r(594, 360, 52)}
          {r(606, 318, 28)}
          <polygon points="616,318 620,214 624,318" />
          {/* One World Trade Center */}
          {r(330, 420, 92)}
          <polygon points="330,420 376,300 422,420" />
          {r(372, 150, 8, 150)}
          {/* the rest of the skyline */}
          {r(190, 548, 84)}
          {r(206, 518, 52, 30)}
          {r(440, 520, 100)}
          {r(460, 488, 60, 32)}
          {r(700, 500, 72)}
          <polygon points="700,500 736,466 772,500" />
          {r(790, 440, 62)}
          {r(862, 566, 92)}
          {r(964, 470, 74)}
          {r(978, 440, 46, 30)}
          {r(1048, 604, 80)}
          {r(90, 624, 82)}
        </>
      }
      cut={
        <>
          {[460, 520, 580, 640, 700].map((y) => slit(574, y, 4, 92))}
          {slit(352, 440, 360, 4)}
          {slit(404, 440, 360, 4)}
          {slit(716, 520, 280, 4)}
          {slit(808, 460, 340, 4)}
          {slit(996, 490, 310, 4)}
          {slit(212, 570, 230, 4)}
        </>
      }
    />
  );
}

/* ---------------- UK — Big Ben, London Eye, The Shard ---------------- */
export function SkylineUk({ className }: { className?: string }) {
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return (
      <line
        key={i}
        x1={780}
        y1={540}
        x2={780 + Math.cos(a) * 196}
        y2={540 + Math.sin(a) * 196}
        strokeWidth={3}
      />
    );
  });
  return (
    <ScanArt
      id="sk-uk"
      title="Big Ben, London Eye and The Shard, UK"
      className={className}
      thin={farTown(5)}
      bold={
        <>
          {/* Elizabeth Tower (Big Ben) */}
          {r(212, 540, 76)}
          {r(222, 300, 56, 240)}
          {r(210, 232, 80, 70)}
          {r(222, 184, 56, 48)}
          <polygon points="222,184 250,64 278,184" />
          {r(246, 24, 8, 44)}
          {/* Houses of Parliament */}
          {r(300, 650, 310, 150)}
          {r(318, 610, 16, 40)}
          {r(366, 620, 16, 30)}
          {r(520, 610, 16, 40)}
          {r(572, 620, 16, 30)}
          {r(440, 590, 60, 60)}
          {/* London Eye */}
          <circle cx="780" cy="540" r="200" fill="none" strokeWidth="9" />
          <circle cx="780" cy="540" r="170" fill="none" strokeWidth="5" />
          {spokes}
          <line x1="780" y1="540" x2="712" y2="800" strokeWidth="14" />
          <line x1="780" y1="540" x2="848" y2="800" strokeWidth="14" />
          {/* The Shard */}
          <polygon points="940,800 1002,300 1014,252 1026,300 1086,800" />
          {r(1100, 640, 70)}
        </>
      }
      cut={
        <>
          <circle cx="250" cy="270" r="24" />
          {slit(240, 360, 150, 4)}
          {[660, 700, 740].map((y) => slit(312, y, 4, 290))}
          <line x1="1014" y1="262" x2="978" y2="800" strokeWidth="3" />
          <line x1="1014" y1="262" x2="1014" y2="800" strokeWidth="3" />
          <line x1="1014" y1="262" x2="1050" y2="800" strokeWidth="3" />
        </>
      }
    />
  );
}
