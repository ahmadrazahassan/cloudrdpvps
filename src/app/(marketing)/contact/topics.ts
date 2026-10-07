/** Kept apart from the "use server" actions file, which may only export async functions. */
export const CONTACT_TOPICS = [
  { value: "sales", label: "A question before I order" },
  { value: "order", label: "My order or payment" },
  { value: "technical", label: "Help with a server" },
  { value: "account", label: "My account" },
  { value: "abuse", label: "Report abuse" },
  { value: "other", label: "Something else" },
] as const;
