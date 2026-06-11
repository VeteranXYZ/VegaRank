import type { Metadata } from "next";
import { HistoryPageClient } from "@/components/history/HistoryPageClient";

export const metadata: Metadata = {
  title: "Research Archive",
  description:
    "Browse stored runs and snapshots to review how setups evolved.",
};

export default function HistoryPage() {
  return <HistoryPageClient />;
}
