import type { Metadata } from "next";
import { LatestRankingsPageClient } from "@/components/rankings/LatestRankingsPageClient";

type RankingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Market Rankings",
  description:
    "Latest rankings by technical structure, confirmation strength, and risk context.",
};

export default async function RankingsPage({ searchParams }: RankingsPageProps) {
  return <LatestRankingsPageClient initialQueryState={await searchParams} />;
}
