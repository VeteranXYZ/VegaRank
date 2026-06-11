import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LatestRankingsPageClient } from "@/components/rankings/LatestRankingsPageClient";
import { buildLatestRankingsPreviewResponse } from "@/components/rankings/latestRankingsPreviewData";

export const metadata: Metadata = {
  title: "Rankings Visual Check",
  description:
    "Visual verification route for VegaRank market rankings.",
};

export default function RankingsVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <LatestRankingsPageClient visualCheckData={buildLatestRankingsPreviewResponse()} />;
}
