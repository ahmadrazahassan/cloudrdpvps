import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The glass globe, turning slowly. The picture is public/global.png prepared by `npm run globe:build` into
 * public/images/locations/globe.webp (just the sphere, on a transparent background), so it sits straight on the page
 * with nothing behind it. It rotates once every 90 seconds and floats a few pixels up and down; both stop for anyone who has
 * asked their device for less motion (the site-wide reduced-motion rule).
 */
export function GlobeArt({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative mx-auto aspect-square w-full animate-[globe-float_8s_ease-in-out_infinite_alternate]", className)}>
      {/* the light it stands in */}
      <span aria-hidden className="absolute inset-x-[16%] bottom-[-2%] h-[8%] rounded-[50%] bg-ink/[0.14] blur-2xl" />
      <div className="absolute inset-0 animate-[globe-spin_90s_linear_infinite] will-change-transform">
        <Image
          src="/images/locations/globe.webp"
          alt="A glass globe turning slowly"
          width={1100}
          height={1100}
          sizes="(min-width: 768px) 640px, 90vw"
          priority={priority}
          draggable={false}
          className="h-full w-full select-none"
        />
      </div>
    </div>
  );
}
