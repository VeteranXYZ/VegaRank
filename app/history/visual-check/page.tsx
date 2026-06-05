import { notFound } from "next/navigation";
import { HistoryPageClient } from "@/components/history/HistoryPageClient";
import { buildHistoryVisualCheckData } from "@/components/history/historyPreviewData";

export default function HistoryVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HistoryPageClient visualCheckData={buildHistoryVisualCheckData()} />;
}
