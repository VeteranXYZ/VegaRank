import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchlistPageClient } from "@/components/watchlist/WatchlistPageClient";
import { buildWatchlistVisualCheckData } from "@/components/watchlist/watchlistPreviewData";

export const metadata: Metadata = {
  title: "Watchlist Visual Check",
  description:
    "Visual verification route for the VegaRank watchlist.",
};

export default function WatchlistVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <WatchlistPageClient visualCheckData={buildWatchlistVisualCheckData()} />
  );
}
