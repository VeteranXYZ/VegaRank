import { LatestScanPageClient } from "@/components/scanner/LatestScanPageClient";

type ScannerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ScannerPage({ searchParams }: ScannerPageProps) {
  return <LatestScanPageClient initialQueryState={await searchParams} />;
}
