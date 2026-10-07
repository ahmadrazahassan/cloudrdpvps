import { Coins, Landmark, QrCode, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import { paymentLogo } from "@/lib/payment-brands";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, LucideIcon> = {
  bank: Landmark,
  mobile_wallet: Smartphone,
  upi: QrCode,
  crypto: Coins,
  other: Wallet,
};

/**
 * A payment method's logo: the brand's own mark when we have it, otherwise a neutral icon for its type.
 * Decorative — the method's name is always written next to it — so it is hidden from screen readers.
 * Pure (no hooks), so server pages and the client checkout flow both use it.
 */
export function PaymentLogo({ name, type, className }: { name: string; type?: string; className?: string }) {
  const logo = paymentLogo(name);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small static brand mark; nothing for next/image to optimise
      <img
        src={logo.src}
        alt=""
        aria-hidden
        height={logo.height}
        style={{ height: logo.height, width: "auto" }}
        className={cn("block shrink-0", className)}
        draggable={false}
      />
    );
  }
  const Icon = TYPE_ICON[type ?? "other"] ?? Wallet;
  return <Icon size={24} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-lav-600", className)} />;
}
