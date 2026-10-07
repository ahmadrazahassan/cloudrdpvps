import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { images, type ImageKey } from "@/content/images";
import { illustrations } from "@/components/illustrations/registry";

interface SiteImageProps {
  name: ImageKey;
  className?: string;
  sizes?: string;
  /** Preload the file — use for the one above-the-fold image. */
  preload?: boolean;
  /** @deprecated Next.js 16 renamed this to `preload`. */
  priority?: boolean;
}

/**
 * Renders a manifest image.
 *  1. If `public/<src>` exists (e.g. generated in ChatGPT), it is used via next/image.
 *  2. Otherwise the code-built SVG illustration for that key is rendered.
 * Images are generated on pure white and blended with `multiply` so they
 * disappear into the #F1F1F1 page background (see prompts/05 §1).
 */
export function SiteImage({ name, className, sizes, preload, priority }: SiteImageProps) {
  const meta = images[name];
  const file = path.join(process.cwd(), "public", meta.src);
  const blend = meta.blend === "multiply" ? "blend-multiply" : undefined;

  if (existsSync(file)) {
    return (
      <Image
        src={meta.src}
        alt={meta.alt}
        width={meta.width}
        height={meta.height}
        sizes={sizes}
        preload={preload ?? priority}
        className={cn("h-auto w-full", blend, className)}
      />
    );
  }

  const Fallback = illustrations[name];
  if (!Fallback) return null;
  return <Fallback className={cn("h-auto w-full", className)} />;
}

/** True when a generated file replaced the code-built illustration. */
export function hasImageFile(name: ImageKey) {
  return existsSync(path.join(process.cwd(), "public", images[name].src));
}
