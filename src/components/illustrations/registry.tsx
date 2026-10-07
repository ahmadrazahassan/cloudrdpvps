import type { ComponentType } from "react";
import type { ImageKey } from "@/content/images";
import {
  FeatAdmin,
  FeatLocations,
  FeatNvme,
  FeatSupport,
  Step1,
  Step2,
  Step3,
  Step4,
} from "./feature-art";
import { DatacenterAisle, ProductRdp, ProductVps } from "./product-art";
import { ServerExploded } from "./server-exploded";
import { SkylineBd, SkylineIn, SkylineUk, SkylineUs } from "./skylines";
import {
  EmptyNotifications,
  EmptyOrders,
  EmptySearch,
  EmptyServices,
  EmptyTickets,
  Error404,
  Error500,
  StatusUnderReview,
  SuccessOrderPlaced,
} from "./state-art";

type Illustration = ComponentType<{ className?: string }>;

/**
 * Code-built fallbacks for each image key. (`auth-art` is drawn by the auth shell itself.)
 */
export const illustrations: Partial<Record<ImageKey, Illustration>> = {
  "hero-server-exploded": ServerExploded,
  "datacenter-aisle": DatacenterAisle,
  "product-rdp": ProductRdp,
  "product-vps": ProductVps,
  "feat-admin": FeatAdmin,
  "feat-nvme": FeatNvme,
  "feat-locations": FeatLocations,
  "feat-support": FeatSupport,
  "step-1": Step1,
  "step-2": Step2,
  "step-3": Step3,
  "step-4": Step4,
  "loc-in": SkylineIn,
  "loc-bd": SkylineBd,
  "loc-us": SkylineUs,
  "loc-uk": SkylineUk,
  "error-404": Error404,
  "error-500": Error500,
  "empty-search": EmptySearch,
  "empty-services": EmptyServices,
  "empty-orders": EmptyOrders,
  "empty-tickets": EmptyTickets,
  "empty-notifications": EmptyNotifications,
  "success-order-placed": SuccessOrderPlaced,
  "status-under-review": StatusUnderReview,
};
