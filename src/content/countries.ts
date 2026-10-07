/**
 * Countries offered for the billing-country setting (ISO 3166-1 alpha-2). Names come from the
 * browser/runtime's own Intl data, so there is no hand-typed list of names to get wrong.
 * The five locations we sell in come first.
 */
const FIRST = ["PK", "IN", "BD", "US", "GB"] as const;
const REST = [
  "AE", "AF", "AL", "AM", "AR", "AT", "AU", "AZ", "BE", "BG", "BH", "BR", "CA", "CH", "CL", "CN", "CO", "CZ", "DE",
  "DK", "DZ", "EG", "ES", "ET", "FI", "FR", "GH", "GR", "HK", "HU", "ID", "IE", "IL", "IQ", "IR", "IT", "JO", "JP",
  "KE", "KG", "KR", "KW", "KZ", "LB", "LK", "MA", "MM", "MX", "MY", "NG", "NL", "NO", "NP", "NZ", "OM", "PH", "PL",
  "PT", "QA", "RO", "RS", "RU", "SA", "SE", "SG", "TH", "TJ", "TR", "TW", "UA", "UZ", "VN", "ZA",
] as const;

export const COUNTRY_CODES: readonly string[] = [...FIRST, ...REST];

export function countryOptions(locale = "en"): { value: string; label: string }[] {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const label = (code: string) => names.of(code) ?? code;
  return [
    ...FIRST.map((c) => ({ value: c, label: label(c) })),
    ...[...REST].map((c) => ({ value: c, label: label(c) })).sort((a, b) => a.label.localeCompare(b.label, locale)),
  ];
}
