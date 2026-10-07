import {
  Art,
  INK,
  IsoBox,
  LAV,
  OnFront,
  OnSide,
  P,
  PAPER,
  TONE,
  dash,
  line,
} from "./iso";

type P = { className?: string };
const thin = { ...line, strokeWidth: 1.3 };

/* ============================ FEATURES ============================ */

/** 001 — terminal window with a key */
export function FeatAdmin({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Terminal window with a key">
      <rect x={46} y={86} width={262} height={198} rx={12} fill={PAPER} {...line} />
      <line x1={46} y1={124} x2={308} y2={124} {...line} />
      {[68, 86, 104].map((cx) => (
        <circle key={cx} cx={cx} cy={105} r={5} fill={PAPER} {...line} />
      ))}
      <path d="M76 158 L98 176 L76 194" {...line} strokeWidth={2.2} />
      <line x1={110} y1={196} x2={140} y2={196} {...line} strokeWidth={2.2} />
      <line x1={76} y1={226} x2={190} y2={226} {...thin} />
      <line x1={76} y1={248} x2={152} y2={248} {...thin} />
      {/* key (lavender accent) */}
      <rect x={196} y={226} width={112} height={14} rx={7} fill={PAPER} {...line} />
      <rect x={206} y={240} width={12} height={22} rx={2} fill={PAPER} {...line} />
      <rect x={230} y={240} width={12} height={16} rx={2} fill={PAPER} {...line} />
      <circle cx={336} cy={233} r={34} fill={LAV} {...line} />
      <circle cx={336} cy={233} r={11} fill={PAPER} {...line} />
    </Art>
  );
}

/** 002 — M.2 NVMe SSD */
export function FeatNvme({ className }: P) {
  const W = 300;
  const D = 66;
  const chips: { x: number; y: number; w: number; d: number; accent?: boolean }[] = [
    { x: 30, y: 10, w: 52, d: 46, accent: true },
    { x: 100, y: 10, w: 42, d: 46 },
    { x: 152, y: 10, w: 42, d: 46 },
    { x: 204, y: 10, w: 42, d: 46 },
  ];
  return (
    <Art viewBox="0 0 400 400" className={className} title="NVMe solid-state drive">
      <g transform="translate(96 110) scale(1.12)">
        <IsoBox x={0} y={0} z={0} w={W} d={D} h={6} top={PAPER} />
        {chips.map((c, i) => (
          <IsoBox key={i} x={c.x} y={c.y} z={6} w={c.w} d={c.d} h={7} top={c.accent ? LAV : PAPER} />
        ))}
        {/* connector fingers on the end face */}
        <OnSide x={0} y={0} z={0} w={W} d={D} h={6}>
          {Array.from({ length: 14 }, (_, i) => (
            <line key={i} x1={5 + i * 4.3} y1={1} x2={5 + i * 4.3} y2={5} {...line} strokeWidth={1} />
          ))}
        </OnSide>
        {/* speed lines */}
        {[-8, 6, 20].map((dy, i) => (
          <line
            key={i}
            x1={P(0, 0, 0)[0] - 78 - i * 12}
            y1={P(0, 0, 0)[1] + 30 + dy * 1.4}
            x2={P(0, 0, 0)[0] - 18 - i * 6}
            y2={P(0, 0, 0)[1] + 30 + dy * 1.4}
            {...line}
            strokeWidth={1.4}
          />
        ))}
      </g>
    </Art>
  );
}

/** 003 — wireframe globe with five pins */
export function FeatLocations({ className }: P) {
  const cx = 200;
  const cy = 206;
  const r = 124;
  const pin = (x: number, y: number, accent?: boolean) => (
    <path
      key={`${x}-${y}`}
      d={`M${x} ${y} L${x - 9} ${y - 17} A11 11 0 1 1 ${x + 9} ${y - 17} Z`}
      fill={accent ? LAV : PAPER}
      {...line}
    />
  );
  const lat = (dy: number) => {
    const rx = Math.sqrt(r * r - dy * dy);
    return (
      <path
        key={dy}
        d={`M${cx - rx} ${cy + dy} A${rx} ${rx * 0.2} 0 0 0 ${cx + rx} ${cy + dy}`}
        {...thin}
      />
    );
  };
  return (
    <Art viewBox="0 0 400 400" className={className} title="Globe with five location pins">
      <circle cx={cx} cy={cy} r={r} fill={PAPER} {...line} />
      <ellipse cx={cx} cy={cy} rx={r * 0.5} ry={r} {...thin} />
      <ellipse cx={cx} cy={cy} rx={r * 0.88} ry={r} {...thin} />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} {...thin} />
      {[-70, 0, 70].map((d) => lat(d))}
      {/* connecting arcs */}
      <path d="M150 150 C185 70 235 70 262 138" {...dash} />
      <path d="M262 138 C290 190 270 230 222 246" {...dash} />
      <path d="M150 150 C110 200 150 250 222 246" {...dash} />
      <path d="M222 246 C240 290 190 306 160 286" {...dash} />
      {pin(150, 150)}
      {pin(262, 138, true)}
      {pin(222, 246)}
      {pin(160, 286)}
      {pin(118, 218)}
    </Art>
  );
}

/** 004 — headset + chat bubble */
export function FeatSupport({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Headset and chat bubble">
      {/* chat bubble */}
      <path
        d="M236 46 H356 a16 16 0 0 1 16 16 V104 a16 16 0 0 1 -16 16 H284 L258 144 V120 H236 a16 16 0 0 1 -16 -16 V62 a16 16 0 0 1 16 -16 Z"
        fill={PAPER}
        {...line}
      />
      <path d="M262 84 L280 102 L318 66" stroke={LAV} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* headset */}
      <path d="M96 258 A104 104 0 0 1 304 258" {...line} strokeWidth={2.2} />
      <path d="M110 258 A90 90 0 0 1 290 258" {...thin} />
      <rect x={72} y={238} width={42} height={86} rx={14} fill={PAPER} {...line} />
      <rect x={286} y={238} width={42} height={86} rx={14} fill={PAPER} {...line} />
      <line x1={93} y1={256} x2={93} y2={306} {...thin} />
      <line x1={307} y1={256} x2={307} y2={306} {...thin} />
      <path d="M93 324 C93 364 130 372 178 372" {...line} strokeWidth={2.2} />
      <rect x={176} y={360} width={34} height={22} rx={10} fill={PAPER} {...line} />
    </Art>
  );
}

/* ============================= STEPS ============================== */

/** 1 — choose a plan (three cards, middle raised) */
export function Step1({ className }: P) {
  const card = (x: number, y: number, h: number) => (
    <g key={x}>
      <rect x={x} y={y} width={96} height={h} rx={10} fill={PAPER} {...line} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={x + 14} y1={y + 62 + i * 22} x2={x + 82 - (i % 2) * 22} y2={y + 62 + i * 22} {...thin} />
      ))}
    </g>
  );
  return (
    <Art viewBox="0 0 400 400" className={className} title="Choosing a plan from three cards">
      {card(34, 126, 170)}
      {card(274, 126, 170)}
      <rect x={152} y={92} width={96} height={204} rx={10} fill={PAPER} {...line} />
      <path d="M152 134 V102 a10 10 0 0 1 10 -10 H238 a10 10 0 0 1 10 10 V134 Z" fill={LAV} stroke={INK} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={166} y1={160 + i * 22} x2={234 - (i % 2) * 24} y2={160 + i * 22} {...thin} />
      ))}
      {/* cursor */}
      <path d="M214 262 L214 318 L228 306 L238 330 L250 324 L240 300 L260 298 Z" fill={PAPER} {...line} />
    </Art>
  );
}

/** 2 — order checklist */
export function Step2({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Order checklist">
      <rect x={96} y={72} width={190} height={266} rx={14} fill={PAPER} {...line} />
      <rect x={150} y={52} width={82} height={38} rx={10} fill={TONE} {...line} />
      {[0, 1, 2, 3].map((i) => {
        const y = 124 + i * 52;
        return (
          <g key={i}>
            <rect x={120} y={y} width={26} height={26} rx={5} fill={PAPER} {...line} />
            <line x1={162} y1={y + 13} x2={262 - (i % 2) * 30} y2={y + 13} {...thin} />
            {i < 2 && (
              <path d={`M126 ${y + 13} L132 ${y + 19} L142 ${y + 7}`} stroke={LAV} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            )}
          </g>
        );
      })}
      {/* price tag on a string */}
      <path d="M286 110 C316 110 316 150 296 156" {...dash} />
      <path d="M284 156 H322 L346 182 L322 208 H284 Z" fill={PAPER} {...line} />
      <circle cx={298} cy={182} r={4} fill={PAPER} {...line} />
    </Art>
  );
}

/** 3 — pay & upload proof */
export function Step3({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Uploading a payment receipt">
      {/* phone */}
      <rect x={118} y={78} width={126} height={242} rx={20} fill={PAPER} {...line} />
      <rect x={132} y={108} width={98} height={186} rx={6} fill={TONE} {...line} strokeWidth={1.2} />
      <line x1={166} y1={92} x2={196} y2={92} {...line} />
      {/* receipt on screen */}
      <rect x={146} y={124} width={70} height={116} rx={3} fill={PAPER} {...line} strokeWidth={1.2} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={156} y1={140 + i * 16} x2={206 - (i % 2) * 18} y2={140 + i * 16} {...thin} strokeWidth={1.1} />
      ))}
      <line x1={156} y1={214} x2={206} y2={214} {...thin} strokeWidth={1.1} />
      <rect x={176} y={222} width={30} height={10} rx={2} fill={INK} stroke="none" />
      {/* upload arrow (lavender accent) */}
      <path d="M181 56 V14 M163 32 L181 12 L199 32" stroke={LAV} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* banknote */}
      <rect x={252} y={236} width={118} height={66} rx={7} fill={PAPER} {...line} />
      <circle cx={311} cy={269} r={16} {...line} />
      <circle cx={268} cy={252} r={3} fill={INK} stroke="none" />
      <circle cx={354} cy={286} r={3} fill={INK} stroke="none" />
    </Art>
  );
}

/** 4 — delivered server with a key tag */
export function Step4({ className }: P) {
  const W = 104;
  const D = 150;
  const H = 210;
  return (
    <Art viewBox="0 0 400 400" className={className} title="Delivered server with a key tag">
      <g transform="translate(216 238)">
        <IsoBox x={0} y={0} z={0} w={W} d={D} h={H} top={PAPER} />
        <OnFront x={0} y={0} z={0} d={D} h={H}>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={10} y={14 + i * 22} width={86} height={14} rx={2} fill={PAPER} {...line} strokeWidth={1.2} />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={14 + i * 14} y1={134} x2={14 + i * 14} y2={168} {...thin} strokeWidth={1.1} />
          ))}
          <circle cx={26} cy={190} r={7} fill={PAPER} {...line} />
          <circle cx={62} cy={190} r={3} fill={INK} stroke="none" />
          <circle cx={76} cy={190} r={3} fill={INK} stroke="none" />
        </OnFront>
        {/* key tag on a loop */}
        <path d={`M${P(W, 40, 150)[0]} ${P(W, 40, 150)[1]} C 130 -10 150 10 142 44`} {...dash} />
        <rect x={126} y={44} width={34} height={46} rx={6} fill={PAPER} {...line} />
        <circle cx={143} cy={58} r={5} fill={PAPER} {...line} />
        <line x1={134} y1={72} x2={152} y2={72} {...thin} />
        <line x1={134} y1={80} x2={148} y2={80} {...thin} />
        {/* check badge (lavender accent) */}
        <circle cx={P(W, 0, H)[0] + 8} cy={P(W, 0, H)[1] - 14} r={26} fill={LAV} {...line} />
        <path
          d={`M${P(W, 0, H)[0] - 6} ${P(W, 0, H)[1] - 14} l10 11 l18 -22`}
          stroke="#fff"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </Art>
  );
}
