/** Kept out of the "use server" actions file, which may only export async functions. */
export const TICKET_CATEGORIES = [
  { value: "cannot_connect", label: "I can't connect to my server" },
  { value: "restart_request", label: "Restart my server" },
  { value: "reinstall_request", label: "Reinstall my server" },
  { value: "technical", label: "Another technical problem" },
  { value: "order", label: "About an order" },
  { value: "billing", label: "Billing or a payment" },
  { value: "other", label: "Something else" },
] as const;

export const categoryLabel = (value: string) => TICKET_CATEGORIES.find((c) => c.value === value)?.label ?? "Support";
