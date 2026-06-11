import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivePageClient } from "@/components/archive/ArchivePageClient";
import { buildArchiveVisualCheckData } from "@/components/archive/archivePreviewData";

export const metadata: Metadata = {
  title: "Archive Visual Check",
  description:
    "Visual verification route for the VegaRank research archive.",
};

export default function ArchiveVisualCheckRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ArchivePageClient visualCheckData={buildArchiveVisualCheckData()} />;
}
