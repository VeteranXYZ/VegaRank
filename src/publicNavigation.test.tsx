import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import { Header } from "@/components/layout/Header";

const pathnameMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));

describe("public navigation surface", () => {
  beforeEach(() => {
    pathnameMock.mockReset();
    pathnameMock.mockReturnValue("/rankings");
  });

  it("uses VegaRank route labels and avoids old scanner/history links in the header", () => {
    const html = renderToStaticMarkup(createElement(Header));

    expect(html).toContain("VegaRank");
    expect(html).toContain('href="/rankings"');
    expect(html).toContain(">Rankings<");
    expect(html).toContain('href="/screener"');
    expect(html).toContain(">Screener<");
    expect(html).toContain('href="/watchlist"');
    expect(html).toContain(">Watchlist<");
    expect(html).toContain('href="/archive"');
    expect(html).toContain(">Archive<");
    expect(html).not.toContain('href="/scanner"');
    expect(html).not.toContain('href="/history"');
  });

  it("uses VegaRank workspace links and avoids old scanner/history routes on home", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain("VegaRank");
    expect(html).toContain('href="/rankings"');
    expect(html).toContain("Market Rankings");
    expect(html).toContain('href="/archive"');
    expect(html).toContain("Research Archive");
    expect(html).not.toContain('href="/scanner"');
    expect(html).not.toContain('href="/history"');
  });
});
