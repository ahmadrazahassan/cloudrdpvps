import { ClipboardCheck, SlidersHorizontal, UserRound, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StepState = "done" | "current" | "todo" | "bad";

/**
 * Plan → Account → Review → Pay, with everything before `current` marked done. Shared by checkout and the pay screen.
 * `signedIn` only changes the words under "Account": a signed-in customer has nothing to do there, and it says so.
 */
export function checkoutSteps(current: "plan" | "account" | "review" | "pay", opts: { signedIn?: boolean; email?: string } = {}): OrderStep[] {
  const all: Omit<OrderStep, "state">[] = [
    { id: "plan", label: "Plan", icon: SlidersHorizontal, meta: "Product, country, power" },
    { id: "account", label: "Account", icon: UserRound, meta: opts.signedIn ? "Signed in" : "Sign in or sign up" },
    { id: "review", label: "Review", icon: ClipboardCheck, meta: "Check and confirm" },
    { id: "pay", label: "Pay", icon: Wallet, meta: "Send your payment" },
  ];
  const at = all.findIndex((s) => s.id === current);
  return all.map((s, i) => ({ ...s, state: i < at ? "done" : i === at ? "current" : "todo" }));
}

export interface OrderStep {
  id: string;
  label: string;
  icon: LucideIcon;
  state: StepState;
  /** Small line under the step: a date, "In progress", a hint. */
  meta?: ReactNode;
}

const ICON: Record<StepState, string> = {
  done: "text-lav-600",
  current: "text-lav-600",
  todo: "text-muted/70",
  bad: "text-bad",
};
const LABEL: Record<StepState, string> = {
  done: "text-ink",
  current: "text-ink",
  todo: "text-muted",
  bad: "text-bad",
};
const NODE: Record<StepState, string> = {
  done: "h-3 w-3 border-lav-600 bg-lav-600",
  current: "h-3.5 w-3.5 border-lav-600 bg-bg",
  todo: "h-3 w-3 border-line-2 bg-bg",
  bad: "h-3 w-3 border-bad bg-bad",
};
const STATE_TEXT: Record<StepState, string> = {
  done: "completed",
  current: "current step",
  todo: "not reached yet",
  bad: "needs attention",
};

/**
 * A centred horizontal stepper: an icon and a label over a track with one node per step.
 * Flat on purpose — the icons sit directly on the page (no chip behind them) and the track is
 * a hairline that turns lavender as far as the order has got.
 *
 * Used for the checkout (Configure → Review → Pay) and for tracking an order after it is placed.
 */
export function OrderSteps({ steps, label, className }: { steps: OrderStep[]; label: string; className?: string }) {
  return (
    <ol
      aria-label={label}
      className={cn("grid", className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((s, i) => {
        const Icon = s.icon;
        const first = i === 0;
        const last = i === steps.length - 1;
        // The track is drawn per step as two halves meeting at the node, so it stays continuous at any width.
        const lineIn = s.state !== "todo";
        const lineOut = s.state === "done";
        return (
          <li key={s.id} aria-current={s.state === "current" ? "step" : undefined} className="flex min-w-0 flex-col items-center text-center">
            <Icon aria-hidden size={28} strokeWidth={1.5} className={ICON[s.state]} />
            <p className={cn("mt-3 px-1 text-[13px] font-semibold leading-tight sm:text-[15px]", LABEL[s.state])}>
              {s.label}
              <span className="sr-only"> — {STATE_TEXT[s.state]}</span>
            </p>
            <div aria-hidden className="relative mt-4 h-4 w-full">
              {!first && <span className={cn("absolute left-0 right-1/2 top-1/2 h-0.5 -translate-y-1/2", lineIn ? "bg-lav-600" : "bg-line-2")} />}
              {!last && <span className={cn("absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2", lineOut ? "bg-lav-600" : "bg-line-2")} />}
              <span className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2", NODE[s.state])} />
            </div>
            {s.meta ? <p className="num-tabular mt-3 px-1 text-[12px] leading-snug text-muted sm:text-[13px]">{s.meta}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
