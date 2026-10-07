import {
  Art,
  INK,
  IsoBox,
  LAV,
  Leader,
  Leader3,
  OnFront,
  OnSide,
  OnTop,
  P,
  PAPER,
  TONE,
  TONE_2,
  line,
  pts,
} from "./iso";

/** Isometric exploded view of a 2U rack server (hero illustration). */
const W = 560; // chassis width  (x)
const D = 240; // chassis depth  (y)
const H = 44; // wall height
const FZ = 10; // tray floor height
const LID_LIFT = 300;
const SC = 0.9; // overall scale of the drawing inside the viewBox
const TX = 475;
const TY = 335;
const CPU_LIFT = 92;
const RAM_LIFT = 64;
const NIC_LIFT = 78;
const SLED_PULL = 70;

const cpuXs = [118, 262];
const ramBanks = [
  { x0: 30, y0: 44 }, // left of CPU1
  { x0: 372, y0: 44 }, // right of CPU2
];
const fanXs = [96, 196, 296];
const sledXs = [276, 344, 412, 480];

const quad = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  z: number,
): [number, number][] => [P(x1, y1, z), P(x2, y1, z), P(x2, y2, z), P(x1, y2, z)];

export function ServerExploded({
  className,
  callouts = true,
}: {
  className?: string;
  callouts?: boolean;
}) {
  // anchor points (screen space, before translate) for the callouts
  const cpuA = P(cpuXs[0]! + 36, 80, FZ + 4 + CPU_LIFT + 32);
  const ramA = P(ramBanks[0]!.x0 + 24, 44, FZ + RAM_LIFT + 26);
  const sledA = P(sledXs[3]! + 60, D + SLED_PULL + 90, 36);
  const nicA = P(452, 112, FZ + NIC_LIFT + 38);

  const T = `translate(${TX} ${TY}) scale(${SC})`;
  const lab = {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: "0.06em",
    fill: "#6E6E78",
  } as const;

  return (
    <Art
      viewBox="0 0 1200 760"
      className={className}
      title="Exploded view of a rack server showing CPU, memory, storage and network card"
    >
      <g transform={T}>
        {/* ---- tray floor + back inner walls ---- */}
        <polygon points={pts(quad(12, 12, W - 12, D - 12, FZ))} fill={TONE} {...line} />
        <polygon
          points={pts([P(12, 12, FZ), P(W - 12, 12, FZ), P(W - 12, 12, H), P(12, 12, H)])}
          fill={PAPER}
          {...line}
        />
        <polygon
          points={pts([P(12, 12, FZ), P(12, D - 12, FZ), P(12, D - 12, H), P(12, 12, H)])}
          fill="#F0F0F3"
          {...line}
        />

        {/* ---- PSU (rear right) ---- */}
        <IsoBox x={440} y={18} z={FZ} w={104} d={84} h={30} top={PAPER} />
        <OnSide x={440} y={18} z={FZ} w={104} d={84} h={30}>
          {[10, 22, 34, 46, 58, 70].map((u) => (
            <line key={u} x1={u} y1={8} x2={u} y2={22} {...line} />
          ))}
        </OnSide>

        {/* ---- DIMM + CPU slots on the floor ---- */}
        {ramBanks.flatMap((b) =>
          [0, 1, 2, 3].map((i) => (
            <polygon
              key={`slot-${b.x0}-${i}`}
              points={pts(quad(b.x0 + i * 14, b.y0, b.x0 + i * 14 + 8, b.y0 + 84, FZ))}
              fill={TONE_2}
              {...line}
              strokeWidth={1.2}
            />
          )),
        )}
        {cpuXs.map((x) => (
          <g key={`sock-${x}`}>
            <polygon points={pts(quad(x - 4, 46, x + 76, 126, FZ))} fill={PAPER} {...line} />
            <polygon points={pts(quad(x + 8, 58, x + 64, 114, FZ))} fill={TONE_2} {...line} />
          </g>
        ))}

        {/* ---- NIC slot ---- */}
        <polygon points={pts(quad(450, 112, 458, 204, FZ))} fill={TONE_2} {...line} strokeWidth={1.2} />

        {/* ---- fan modules (front of tray) ---- */}
        {fanXs.map((x) => (
          <g key={`fan-${x}`}>
            <IsoBox x={x} y={170} z={FZ} w={80} d={26} h={32} />
            <OnFront x={x} y={170} z={FZ} d={26} h={32}>
              <rect x={5} y={4} width={70} height={24} rx={3} {...line} fill={PAPER} />
              <circle cx={40} cy={16} r={10} {...line} />
              <circle cx={40} cy={16} r={2.5} fill={INK} stroke="none" />
              <path d="M40 6 C47 9 47 14 40 16 M50 16 C47 23 42 23 40 16 M40 26 C33 23 33 18 40 16 M30 16 C33 9 38 9 40 16" {...line} strokeWidth={1.2} />
            </OnFront>
          </g>
        ))}

        {/* ---- outer front + side walls and rim ---- */}
        <IsoBox x={0} y={0} z={0} w={W} d={D} h={H} noTop />
        <OnFront x={0} y={0} z={0} d={D} h={H}>
          {/* drive bay openings */}
          {sledXs.map((x) => (
            <rect key={x} x={x} y={10} width={60} height={22} rx={2} fill={PAPER} {...line} />
          ))}
          {/* status LEDs + power */}
          <circle cx={26} cy={22} r={5} {...line} fill={PAPER} />
          <circle cx={46} cy={22} r={2.5} fill={INK} stroke="none" />
          <circle cx={58} cy={22} r={2.5} fill={LAV} stroke="none" />
          <line x1={92} y1={14} x2={92} y2={30} {...line} strokeWidth={1.2} />
          <line x1={104} y1={14} x2={104} y2={30} {...line} strokeWidth={1.2} />
          <line x1={116} y1={14} x2={116} y2={30} {...line} strokeWidth={1.2} />
        </OnFront>
        <path
          d={`M${pts([P(0, 0, H), P(W, 0, H), P(W, D, H), P(0, D, H)]).replaceAll(" ", " L")} Z M${pts([P(12, 12, H), P(12, D - 12, H), P(W - 12, D - 12, H), P(W - 12, 12, H)]).replaceAll(" ", " L")} Z`}
          fill={PAPER}
          fillRule="evenodd"
          {...line}
        />

        {/* ---- RAM modules (floating) ---- */}
        {ramBanks.flatMap((b) =>
          [0, 1, 2, 3].map((i) => {
            const x = b.x0 + i * 14;
            return (
              <g key={`dimm-${b.x0}-${i}`}>
                <Leader x={x + 8} y={b.y0 + 84} z1={FZ} z2={FZ + RAM_LIFT} />
                <Leader x={x + 8} y={b.y0} z1={FZ} z2={FZ + RAM_LIFT} />
                <IsoBox x={x} y={b.y0} z={FZ + RAM_LIFT} w={8} d={84} h={26} />
                <OnSide x={x} y={b.y0} z={FZ + RAM_LIFT} w={8} d={84} h={26}>
                  {[10, 32, 54].map((u) => (
                    <rect key={u} x={u} y={6} width={16} height={11} rx={1.5} fill={PAPER} {...line} strokeWidth={1.1} />
                  ))}
                  <line x1={4} y1={23} x2={80} y2={23} {...line} strokeWidth={1.1} />
                </OnSide>
              </g>
            );
          }),
        )}

        {/* ---- NIC (floating) ---- */}
        <Leader x={454} y={204} z1={FZ} z2={FZ + NIC_LIFT} />
        <Leader x={454} y={112} z1={FZ} z2={FZ + NIC_LIFT} />
        <IsoBox x={450} y={112} z={FZ + NIC_LIFT} w={8} d={92} h={38} />
        <OnSide x={450} y={112} z={FZ + NIC_LIFT} w={8} d={92} h={38}>
          <rect x={8} y={8} width={26} height={18} rx={2} fill={PAPER} {...line} />
          <rect x={40} y={8} width={26} height={18} rx={2} fill={PAPER} {...line} />
          <rect x={72} y={12} width={12} height={10} rx={1.5} fill={LAV} stroke="none" opacity={0} />
        </OnSide>

        {/* ---- CPU heatsinks (floating, lavender accent) ---- */}
        {cpuXs.map((x) => (
          <g key={`hs-${x}`}>
            <Leader x={x + 72} y={122} z1={FZ} z2={FZ + 4 + CPU_LIFT} />
            <Leader x={x} y={122} z1={FZ} z2={FZ + 4 + CPU_LIFT} />
            <Leader x={x + 72} y={50} z1={FZ} z2={FZ + 4 + CPU_LIFT} />
            <IsoBox x={x} y={50} z={FZ + 4 + CPU_LIFT} w={72} d={72} h={32} top={LAV} />
            <OnFront x={x} y={50} z={FZ + 4 + CPU_LIFT} d={72} h={32}>
              {Array.from({ length: 8 }, (_, i) => (
                <line key={i} x1={6 + i * 8.6} y1={4} x2={6 + i * 8.6} y2={28} {...line} strokeWidth={1.2} />
              ))}
            </OnFront>
            <OnTop x={x} y={50} z={FZ + 4 + CPU_LIFT} h={32}>
              <rect x={14} y={14} width={44} height={44} rx={3} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
            </OnTop>
          </g>
        ))}

        {/* ---- drive sleds pulled out of the front ---- */}
        {sledXs.map((x) => (
          <g key={`sled-${x}`}>
            <Leader3 from={[x + 6, D, 21]} to={[x + 6, D + SLED_PULL, 21]} />
            <Leader3 from={[x + 54, D, 21]} to={[x + 54, D + SLED_PULL, 21]} />
            <IsoBox x={x} y={D + SLED_PULL} z={14} w={60} d={92} h={16} top={PAPER} />
            <OnTop x={x} y={D + SLED_PULL} z={14} h={16}>
              <rect x={8} y={10} width={44} height={22} rx={2} {...line} strokeWidth={1.2} fill={TONE} />
              <line x1={8} y1={52} x2={52} y2={52} {...line} strokeWidth={1.2} />
              <line x1={8} y1={60} x2={40} y2={60} {...line} strokeWidth={1.2} />
            </OnTop>
            <OnFront x={x} y={D + SLED_PULL} z={14} d={92} h={16}>
              <circle cx={50} cy={8} r={2.2} fill={x === sledXs[1] ? LAV : INK} stroke="none" />
            </OnFront>
          </g>
        ))}

        {/* ---- lid ---- */}
        <Leader x={W} y={0} z1={H} z2={H + LID_LIFT} />
        <Leader x={0} y={D} z1={H} z2={H + LID_LIFT} />
        <Leader x={W} y={D} z1={H} z2={H + LID_LIFT} />
        <IsoBox x={0} y={0} z={H + LID_LIFT} w={W} d={D} h={14} />
        <OnTop x={0} y={0} z={H + LID_LIFT} h={14}>
          {Array.from({ length: 11 }, (_, i) => (
            <line key={i} x1={330 + i * 14} y1={46} x2={330 + i * 14} y2={150} {...line} strokeWidth={1.3} />
          ))}
          <rect x={40} y={70} width={150} height={76} rx={3} fill="none" {...line} strokeWidth={1.3} />
          <line x1={56} y1={96} x2={160} y2={96} {...line} strokeWidth={1.2} />
          <line x1={56} y1={114} x2={130} y2={114} {...line} strokeWidth={1.2} />
        </OnTop>
      </g>

      {/* ---- callouts (hidden on small screens) ---- */}
      {callouts && (
        <g className="max-sm:hidden" aria-hidden>
          {[
            { a: cpuA, text: "CPU", lx: 210, side: "left" as const, y: 230 },
            { a: ramA, text: "RAM", lx: 210, side: "left" as const, y: 350 },
            { a: nicA, text: "NIC", lx: 1000, side: "right" as const, y: 330 },
            { a: sledA, text: "NVMe", lx: 1000, side: "right" as const, y: 640 },
          ].map(({ a, text, lx, side, y }) => {
            const ax = a[0] * SC + TX;
            const ay = a[1] * SC + TY;
            const textX = side === "left" ? lx - 12 : lx + 12;
            return (
              <g key={text}>
                <polyline
                  points={`${ax},${ay} ${lx},${y} ${side === "left" ? lx - 8 : lx + 8},${y}`}
                  fill="none"
                  stroke="#6E6E78"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={ax} cy={ay} r={3.5} fill={LAV} />
                <text
                  x={textX}
                  y={y + 5}
                  textAnchor={side === "left" ? "end" : "start"}
                  style={lab}
                >
                  {text}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </Art>
  );
}
