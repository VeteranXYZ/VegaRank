import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryPageClient } from "@/components/history/HistoryPageClient";
import { buildHistoryVisualCheckData } from "@/components/history/historyPreviewData";

export const metadata: Metadata = {
  title: "Archive Visual Check",
  description:
    "Visual verification route for the VegaRank research archive.",
};

export default function ArchiveVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HistoryPageClient visualCheckData={buildHistoryVisualCheckData()} />;
}
