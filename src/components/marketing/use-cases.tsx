import { Briefcase, Laptop, Monitor, Terminal } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Eyebrow } from "@/components/shared/primitives";

const cases = [
  {
    icon: Monitor,
    title: "Trading platforms",
    body: "Keep your trading software running on a Windows machine you can reach from anywhere.",
  },
  {
    icon: Laptop,
    title: "Remote work",
    body: "A consistent Windows desktop for you or your team, whatever device you connect from.",
  },
  {
    icon: Terminal,
    title: "Development & testing",
    body: "A clean Windows environment for building, testing and trying out software.",
  },
  {
    icon: Briefcase,
    title: "Business applications",
    body: "Host the Windows-only tools your business depends on, accessible around the clock.",
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="section-pad border-t border-line">
      <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <div>
          <Eyebrow>USE CASES</Eyebrow>
          <h2 className="display-h2 mt-6 max-w-[14ch] text-balance">
            Built for everyday Windows work.
          </h2>
        </div>
        <ul className="border-t border-line">
          {cases.map((c, i) => (
            <li key={c.title} className="border-b border-line">
              <Reveal delay={i * 0.05} className="flex items-start gap-5 py-6">
                <c.icon
                  size={24}
                  strokeWidth={1.5}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-lav-600"
                />
                <div>
                  <h3 className="text-[18px] font-semibold text-ink">{c.title}</h3>
                  <p className="mt-1.5 max-w-[52ch] text-[15px] leading-relaxed text-muted">
                    {c.body}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
