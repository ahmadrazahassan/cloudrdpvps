import { Coins, Landmark, QrCode, Smartphone } from "lucide-react";
import { PaymentLogo } from "@/components/shared/payment-logo";
import { Reveal } from "@/components/shared/reveal";
import { Eyebrow } from "@/components/shared/primitives";
import { getCatalog } from "@/lib/catalog";

const categories = [
  { icon: Landmark, title: "Bank transfer", body: "Send a transfer from your bank and upload the receipt." },
  { icon: Smartphone, title: "Mobile wallets", body: "Pay from a local mobile wallet where one is available." },
  { icon: QrCode, title: "UPI", body: "Scan a QR code or enter a UPI ID for supported regions." },
  { icon: Coins, title: "Crypto", body: "Send a supported stablecoin to the address shown at checkout." },
];

const regionNames: Record<string, string> = {
  PK: "Pakistan",
  IN: "India",
  BD: "Bangladesh",
  "": "International",
};

export async function Payments() {
  const catalog = await getCatalog();
  const active = catalog.paymentMethods;

  // Group active methods by region (only rendered once the owner enables some).
  const groups = new Map<string, typeof active>();
  for (const m of active) {
    const keys = m.regions.length ? m.regions : [""];
    for (const k of keys) groups.set(k, [...(groups.get(k) ?? []), m]);
  }

  return (
    <section id="payments" className="section-pad border-t border-line">
      <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <Reveal>
          <Eyebrow>PAYMENTS</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[16ch] text-balance">
            Pay the way that works for you.
          </h2>
          <p className="mt-5 max-w-[48ch] text-[17px] leading-[1.65] text-ink-2">
            Payments are made manually. Choose a method at checkout, send the
            payment, and upload your proof. Our team verifies it before your server
            is delivered.
          </p>
          <p className="mt-4 max-w-[48ch] text-sm text-muted">
            Account details are shown once you&apos;ve placed an order.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          {groups.size > 0 ? (
            <div className="ruled-wrap">
              <div className="ruled grid sm:grid-cols-2">
                {[...groups.entries()].map(([region, methods]) => (
                  <div key={region} className="p-5">
                    <p className="label-caps">{regionNames[region] ?? region}</p>
                    <ul className="mt-4 space-y-3.5 text-[15px] text-ink">
                      {methods.map((m) => (
                        <li key={m.id} className="flex items-center gap-3">
                          <span className="flex h-7 w-10 shrink-0 items-center justify-center">
                            <PaymentLogo name={m.name} type={m.type} className="max-w-full object-contain" />
                          </span>
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ul className="grid border-t border-line sm:grid-cols-2">
              {categories.map((c, i) => (
                <li
                  key={c.title}
                  className={`border-b border-line py-6 sm:px-6 ${i % 2 === 1 ? "sm:border-l" : "sm:pl-0"}`}
                >
                  <c.icon size={24} strokeWidth={1.5} aria-hidden className="text-lav-600" />
                  <h3 className="mt-4 text-[17px] font-semibold text-ink">{c.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </section>
  );
}
