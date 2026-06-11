export const SCANNER_CODE_DOMAINS = [
  "GR",
  "QH",
  "VL",
  "PX",
  "MO",
  "TR",
  "VO",
  "RK",
  "ST",
  "AC",
  "NX",
] as const;

export type ScannerCodeDomain = (typeof SCANNER_CODE_DOMAINS)[number];

export function isScannerCodeDomain(value: string): value is ScannerCodeDomain {
  return SCANNER_CODE_DOMAINS.includes(value as ScannerCodeDomain);
}
