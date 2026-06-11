import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LatestScanPageClient } from "@/components/scanner/LatestScanPageClient";
import { buildLatestScanPreviewResponse } from "@/components/scanner/latestScanPreviewData";

export const metadata: Metadata = {
  title: "Rankings Visual Check",
  description:
    "Visual verification route for VegaRank market rankings.",
};

export default function RankingsVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <LatestScanPageClient visualCheckData={buildLatestScanPreviewResponse()} />;
}
