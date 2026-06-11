import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const metadata: Metadata = {
  title: {
    default: "VegaRank",
    template: "%s | VegaRank",
  },
  description:
    "Rank crypto setups by structure, confirmation, and risk context.",
  openGraph: {
    title: "VegaRank",
    description:
      "Rank crypto setups by structure, confirmation, and risk context.",
    url: "https://vegarank.com",
    siteName: "VegaRank",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VegaRank",
    description:
      "Rank crypto setups by structure, confirmation, and risk context.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
