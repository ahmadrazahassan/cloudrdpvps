import Link from "next/link";
import { cn } from "@/lib/utils";
import { site } from "@/content/site";
import { LogoArtwork } from "./brand-mark";

export { LogoMark, LogoArtwork } from "./brand-mark";

export function Logo({
  className,
  tone = "dark",
  href = "/",
  size = "md",
}: {
  className?: string;
  tone?: "dark" | "light";
  href?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const artwork = <LogoArtwork tone={tone} className={cn("block h-auto", size === "lg" ? "w-[260px]" : size === "sm" ? "w-[156px]" : "w-[200px]")} />;
  const cls = cn("inline-flex shrink-0 items-center align-middle", className);
  if (!href) return <span className={cls} role="img" aria-label={site.name}>{artwork}</span>;
  return <Link href={href} className={cls} aria-label={`${site.name} home`}>{artwork}</Link>;
}
