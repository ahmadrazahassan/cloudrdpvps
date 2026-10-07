import { Art, INK, LAV, PAPER, TONE, dash, line } from "./iso";

type P = { className?: string };
const thin = { ...line, strokeWidth: 1.3 };

/** error-404 — network cable pulled out of its wall socket. */
export function Error404({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Unplugged network cable">
      {/* wall socket */}
      <rect x={272} y={128} width={96} height={150} rx={12} fill={PAPER} {...line} />
      <rect x={288} y={176} width={64} height={54} rx={5} fill={TONE} {...line} />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={296 + i * 9.5} y1={216} x2={296 + i * 9.5} y2={230} {...line} strokeWidth={1.3} />
      ))}
      <circle cx={320} cy={150} r={4} fill={INK} stroke="none" />
      {/* cable */}
      <path d="M24 290 C 70 290, 90 210, 120 204" stroke={INK} strokeWidth={13} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M24 290 C 70 290, 90 210, 120 204" stroke={PAPER} strokeWidth={9} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {/* plug (lavender accent) */}
      <rect x={118} y={178} width={70} height={52} rx={7} fill={LAV} {...line} />
      <rect x={188} y={188} width={26} height={32} rx={3} fill={PAPER} {...line} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={194 + i * 6} y1={196} x2={194 + i * 6} y2={212} {...line} strokeWidth={1.2} />
      ))}
      {/* gap */}
      <line x1={222} y1={204} x2={278} y2={204} {...dash} />
    </Art>
  );
}

/** A thick ink-outlined stroke with a coloured core (used for handles and cables). */
function Rod({ d, color = LAV, width = 14 }: { d: string; color?: string; width?: number }) {
  return (
    <>
      <path d={d} stroke={INK} strokeWidth={width} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={d} stroke={color} strokeWidth={width - 4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </>
  );
}

/** empty-search — a magnifier over an empty page. */
export function EmptySearch({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Magnifier over an empty page">
      <path d="M106 64 H236 L290 118 V318 a12 12 0 0 1 -12 12 H106 a12 12 0 0 1 -12 -12 V76 a12 12 0 0 1 12 -12 Z" fill={PAPER} {...line} />
      <path d="M236 64 V118 H290" fill={TONE} {...line} />
      {[150, 182, 214].map((y, i) => (
        <line key={y} x1={122} y1={y} x2={i === 2 ? 190 : 250} y2={y} {...dash} />
      ))}
      <Rod d="M286 286 L336 336" />
      <circle cx={248} cy={248} r={62} fill={PAPER} {...line} />
      <path d="M222 252 H274" {...line} strokeWidth={2} />
    </Art>
  );
}

/** error-500 — a server with a warning sign. */
export function Error500({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Server under maintenance">
      {[92, 176, 260].map((y, i) => (
        <g key={y}>
          <rect x={72} y={y} width={216} height={64} rx={10} fill={i === 1 ? TONE : PAPER} {...line} />
          <circle cx={100} cy={y + 32} r={5} fill={i === 0 ? LAV : PAPER} {...line} />
          <line x1={124} y1={y + 32} x2={236} y2={y + 32} {...thin} />
          <line x1={252} y1={y + 24} x2={268} y2={y + 24} {...thin} />
          <line x1={252} y1={y + 40} x2={268} y2={y + 40} {...thin} />
        </g>
      ))}
      {/* warning sign */}
      <path d="M312 54 L372 158 H252 Z" fill={LAV} {...line} />
      <line x1={312} y1={90} x2={312} y2={124} stroke={PAPER} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={312} cy={141} r={3.4} fill={PAPER} stroke="none" />
    </Art>
  );
}

/** empty-services — an empty server rack. */
export function EmptyServices({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Empty server rack">
      <rect x={96} y={52} width={208} height={296} rx={14} fill={PAPER} {...line} />
      <line x1={96} y1={92} x2={304} y2={92} {...line} />
      <circle cx={122} cy={72} r={5} fill={LAV} {...line} />
      {[112, 188, 264].map((y) => (
        <rect key={y} x={116} y={y} width={168} height={60} rx={8} {...dash} />
      ))}
      <line x1={60} y1={348} x2={340} y2={348} {...line} />
    </Art>
  );
}

/** empty-orders — an empty tray with the outline of a receipt above it. */
export function EmptyOrders({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Empty orders tray">
      <path d="M128 74 H272 V196 L252 184 L232 196 L212 184 L192 196 L172 184 L152 196 L128 184 Z" {...dash} />
      {[110, 140].map((y) => (
        <line key={y} x1={152} y1={y} x2={248} y2={y} {...dash} />
      ))}
      <path d="M64 232 H336 L306 332 H94 Z" fill={PAPER} {...line} />
      <path d="M64 232 L100 262 H300 L336 232" fill={TONE} {...line} />
      <line x1={100} y1={262} x2={94} y2={332} {...line} />
      <line x1={300} y1={262} x2={306} y2={332} {...line} />
      <circle cx={200} cy={298} r={7} fill={LAV} {...line} />
    </Art>
  );
}

/** empty-tickets — an empty inbox (an open envelope with nothing in it). */
export function EmptyTickets({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Empty inbox">
      {/* open flap, then the body with its folded front */}
      <path d="M72 168 L200 72 L328 168 Z" fill={PAPER} {...line} />
      <rect x={72} y={168} width={256} height={158} rx={12} fill={PAPER} {...line} />
      <path d="M72 180 L200 266 L328 180" fill={TONE} {...line} />
      <line x1={72} y1={316} x2={160} y2={246} {...thin} />
      <line x1={328} y1={316} x2={240} y2={246} {...thin} />
      <circle cx={200} cy={266} r={9} fill={LAV} {...line} />
    </Art>
  );
}

/** empty-notifications — a bell with a check mark. */
export function EmptyNotifications({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Bell with check mark">
      <path
        d="M200 80 C 148 80 128 124 128 176 V 236 L 104 272 H 296 L 272 236 V 176 C 272 124 252 80 200 80 Z"
        fill={PAPER}
        {...line}
      />
      <path d="M172 272 a28 28 0 0 0 56 0" fill={PAPER} {...line} />
      <line x1={200} y1={60} x2={200} y2={80} {...line} />
      <circle cx={282} cy={118} r={34} fill={LAV} {...line} />
      <path d="M266 118 L277 129 L298 107" stroke={PAPER} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </Art>
  );
}

/** success-order-placed — a server with a check mark. */
export function SuccessOrderPlaced({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Server with check mark">
      {[120, 204].map((y, i) => (
        <g key={y}>
          <rect x={64} y={y} width={216} height={64} rx={10} fill={i === 1 ? TONE : PAPER} {...line} />
          <circle cx={92} cy={y + 32} r={5} fill={PAPER} {...line} />
          <line x1={116} y1={y + 32} x2={228} y2={y + 32} {...thin} />
          <line x1={244} y1={y + 24} x2={260} y2={y + 24} {...thin} />
          <line x1={244} y1={y + 40} x2={260} y2={y + 40} {...thin} />
        </g>
      ))}
      <line x1={64} y1={296} x2={280} y2={296} {...line} />
      <circle cx={290} cy={112} r={46} fill={LAV} {...line} />
      <path d="M268 112 L284 128 L314 96" stroke={PAPER} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </Art>
  );
}

/** status-under-review — a document being checked. */
export function StatusUnderReview({ className }: P) {
  return (
    <Art viewBox="0 0 400 400" className={className} title="Document being reviewed">
      <path d="M96 56 H226 L280 110 V316 a12 12 0 0 1 -12 12 H96 a12 12 0 0 1 -12 -12 V68 a12 12 0 0 1 12 -12 Z" fill={PAPER} {...line} />
      <path d="M226 56 V110 H280" fill={TONE} {...line} />
      {[140, 172, 204, 236].map((y, i) => (
        <line key={y} x1={112} y1={y} x2={i === 3 ? 180 : 248} y2={y} {...thin} />
      ))}
      <Rod d="M284 296 L334 346" />
      <circle cx={246} cy={258} r={58} fill={PAPER} {...line} />
      <path d="M222 260 L240 278 L274 240" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </Art>
  );
}
