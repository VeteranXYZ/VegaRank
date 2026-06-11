import type { Metadata } from "next";
import { LatestScanPageClient } from "@/components/scanner/LatestScanPageClient";

type ScannerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Market Rankings",
  description:
    "Latest rankings by technical structure, confirmation strength, and risk context.",
};

export default async function ScannerPage({ searchParams }: ScannerPageProps) {
  return <LatestScanPageClient initialQueryState={await searchParams} />;
}
