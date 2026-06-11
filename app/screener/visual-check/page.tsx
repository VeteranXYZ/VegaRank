import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MtfScreenerVisualCheckPage } from "@/components/screener/MtfScreenerVisualCheckPage";

export const metadata: Metadata = {
  title: "Screener Visual Check",
  description:
    "Visual verification route for the VegaRank multi-timeframe screener.",
};

export default function ScreenerVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <MtfScreenerVisualCheckPage />;
}
