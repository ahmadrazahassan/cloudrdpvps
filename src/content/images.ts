/**
 * Image manifest — the single registry for every illustration on the site.
 * Mirrors prompts/05-image-generation-prompts.md §5.
 *
 * Every key already renders a code-built SVG illustration. If a file exists at
 * `public/<src>` (e.g. generated in ChatGPT with the exact filename below) the
 * <SiteImage> component uses the file instead. No code changes needed.
 */
export type ImageKey =
  | "hero-section"
  | "hero-server-exploded"
  | "datacenter-aisle"
  | "product-rdp"
  | "product-vps"
  | "feat-admin"
  | "feat-nvme"
  | "feat-locations"
  | "feat-support"
  | "step-1"
  | "step-2"
  | "step-3"
  | "step-4"
  | "loc-in"
  | "loc-bd"
  | "loc-us"
  | "loc-uk"
  | "auth-art"
  | "empty-services"
  | "empty-orders"
  | "empty-tickets"
  | "empty-notifications"
  | "empty-search"
  | "error-404"
  | "error-500"
  | "success-order-placed"
  | "status-under-review";

export interface ImageMeta {
  src: string;
  width: number;
  height: number;
  alt: string;
  blend: "multiply" | "none";
}

const sq = (src: string, alt: string): ImageMeta => ({
  src,
  width: 1024,
  height: 1024,
  alt,
  blend: "multiply",
});
const land = (src: string, alt: string): ImageMeta => ({
  src,
  width: 1536,
  height: 1024,
  alt,
  blend: "multiply",
});

export const images: Record<ImageKey, ImageMeta> = {
  // Homepage hero backdrop (16:9). Its own background is #F1F1F1, the page colour, so it is not multiplied.
  "hero-section": {
    src: "/images/hero/hero-section.webp",
    width: 1672,
    height: 941,
    alt: "Isometric illustration of a server tower connected to smaller modules",
    blend: "none",
  },
  "hero-server-exploded": land("/images/hero/hero-server-exploded.png", "Exploded view of a rack server showing CPU, memory, storage and network card"),
  "datacenter-aisle": land("/images/hero/datacenter-aisle.png", "Data centre aisle between two rows of server racks"),
  "product-rdp": sq("/images/products/product-rdp.png", "Desktop monitor showing remote Windows desktop windows"),
  "product-vps": sq("/images/products/product-vps.png", "Stack of virtual server layers"),
  "feat-admin": sq("/images/features/feat-admin.png", "Terminal window with a key"),
  "feat-nvme": sq("/images/features/feat-nvme.png", "NVMe solid-state drive"),
  "feat-locations": sq("/images/features/feat-locations.png", "Globe with five location pins"),
  "feat-support": sq("/images/features/feat-support.png", "Headset and chat bubble"),
  "step-1": sq("/images/process/step-1.png", "Choosing a plan from three cards"),
  "step-2": sq("/images/process/step-2.png", "Order checklist"),
  "step-3": sq("/images/process/step-3.png", "Uploading a payment receipt"),
  "step-4": sq("/images/process/step-4.png", "Delivered server with a key tag"),
  "loc-in": land("/images/locations/loc-in.png", "Gateway of India and Mumbai skyline, India"),
  "loc-bd": land("/images/locations/loc-bd.png", "National Parliament House and Dhaka skyline, Bangladesh"),
  "loc-us": land("/images/locations/loc-us.png", "Manhattan skyline, USA"),
  "loc-uk": land("/images/locations/loc-uk.png", "Big Ben, London Eye and The Shard, UK"),
  "auth-art": { src: "/images/auth/auth-art.png", width: 1024, height: 1536, alt: "Server rack illustration", blend: "multiply" },
  "empty-services": sq("/images/states/empty-services.png", "Empty server rack"),
  "empty-orders": sq("/images/states/empty-orders.png", "Empty orders tray"),
  "empty-tickets": sq("/images/states/empty-tickets.png", "Empty inbox"),
  "empty-notifications": sq("/images/states/empty-notifications.png", "Bell with check mark"),
  "empty-search": sq("/images/states/empty-search.png", "Magnifier over an empty page"),
  "error-404": sq("/images/states/error-404.png", "Unplugged network cable"),
  "error-500": sq("/images/states/error-500.png", "Server under maintenance"),
  "success-order-placed": sq("/images/states/success-order-placed.png", "Server with check mark"),
  "status-under-review": sq("/images/states/status-under-review.png", "Document being reviewed"),
};
