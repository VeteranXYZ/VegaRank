import type { Metadata } from "next";
import { WatchlistPageClient } from "@/components/watchlist/WatchlistPageClient";

export const metadata: Metadata = {
  title: "Watchlist",
  description:
    "Monitor selected symbols against the latest research snapshot.",
};

export default function WatchlistPage() {
  return <WatchlistPageClient />;
}
