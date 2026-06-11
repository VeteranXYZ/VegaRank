import type { Metadata } from "next";
import { ArchivePageClient } from "@/components/archive/ArchivePageClient";

export const metadata: Metadata = {
  title: "Research Archive",
  description:
    "Browse stored runs and snapshots to review how setups evolved.",
};

export default function ArchivePage() {
  return <ArchivePageClient />;
}
