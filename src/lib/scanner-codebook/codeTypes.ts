import type { Language } from "@/lib/i18n/dictionaries";
import type { ScannerCodeDomain } from "./domains";

export type ScannerCode = `${ScannerCodeDomain}_${number}`;
export type ScannerCodeSeverity =
  | "neutral"
  | "info"
  | "positive"
  | "warning"
  | "risk"
  | "block";
export type ScannerCodeStatus = "active" | "deprecated";
export type ScannerCodeCategory =
  | "group"
  | "reason"
  | "signal"
  | "risk"
  | "setup"
  | "action"
  | "quality"
  | "metric"
  | "system";

export type ScannerCodeMetadata = {
  code: ScannerCode;
  domain: ScannerCodeDomain;
  severity: ScannerCodeSeverity;
  internalName: string;
  status: ScannerCodeStatus;
  category?: ScannerCodeCategory;
};

export type ScannerCodeExplanation = {
  label: string;
  short: string;
};

export type ScannerCodeDictionary = Partial<
  Record<ScannerCode, ScannerCodeExplanation>
>;

export type ExplainScannerCodeOptions = {
  language?: Language;
};

export const SCANNER_CODE_SCHEMA_VERSION = "1.0.0";
export const SCANNER_DICTIONARY_VERSION = "1.0.0";
export const SCANNER_PROTOCOL_VERSION = "19.0.0";
