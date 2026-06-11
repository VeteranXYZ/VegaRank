import type { Metadata } from "next";
import { MultiTimeframeScreenerPageClient } from "@/components/screener/MultiTimeframeScreenerPageClient";

export const metadata: Metadata = {
  title: "Multi-Timeframe Screener",
  description:
    "Compare joined multi-timeframe research snapshots for validation.",
};

export default function ScreenerPage() {
  return <MultiTimeframeScreenerPageClient />;
}
