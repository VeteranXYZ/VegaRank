import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppLanguageProvider } from "@/lib/i18n/AppLanguageProvider";
import { LanguageSwitch } from "./LanguageSwitch";

describe("LanguageSwitch", () => {
  it("renders a compact English and Chinese language switch", () => {
    const html = renderToStaticMarkup(
      createElement(
        AppLanguageProvider,
        null,
        createElement(LanguageSwitch),
      ),
    );

    expect(html).toContain("EN");
    expect(html).toContain("中文");
    expect(html).toContain('aria-pressed="true"');
  });
});
