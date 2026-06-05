import { notFound } from "next/navigation";
import { LatestScanPageClient } from "@/components/scanner/LatestScanPageClient";
import { buildLatestScanPreviewResponse } from "@/components/scanner/latestScanPreviewData";

export default function ScannerVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <LatestScanPageClient visualCheckData={buildLatestScanPreviewResponse()} />;
}
