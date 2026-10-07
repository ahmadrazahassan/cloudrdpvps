import type { SVGProps } from "react";
import brand from "@/content/brand.json";

/** Shared geometry for the site, social preview, and generated icon assets. */
export function LogoMark({
  className,
  tone = "dark",
  monochrome = false,
  ...props
}: SVGProps<SVGSVGElement> & {
  tone?: "dark" | "light";
  monochrome?: boolean;
}) {
  const color = tone === "light" ? brand.light : brand.ink;
  const accent = monochrome ? color : tone === "light" ? brand.lightAccent : brand.primary;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={brand.viewBox}
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {brand.paths.map((p, i) => <path key={i} d={p.d} transform={p.transform} fill={p.role === "accent" ? accent : color} />)}
    </svg>
  );
}

/** Complete logo artwork, including outlined regular-weight letters. */
export function LogoArtwork({
  tone = "dark",
  ...props
}: SVGProps<SVGSVGElement> & { tone?: "dark" | "light" }) {
  const color = tone === "light" ? brand.light : brand.ink;
  const accent = tone === "light" ? brand.lightAccent : brand.primary;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={brand.lockupViewBox} fill="none" aria-hidden="true" focusable="false" {...props}>
      {brand.lockupPaths.map((p, i) => (
        <path key={i} d={p.d} transform={p.transform} fill={p.role === "accent" ? accent : color} />
      ))}
    </svg>
  );
}
