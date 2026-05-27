import { afterEach, describe, expect, it, vi } from "vitest";
import { isCachedSourceEnabledInUi, isLocalSourceEnabledInUi } from "./sourceUi";

describe("scanner source UI", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps local source available outside Cloudflare production flags", () => {
    expect(isLocalSourceEnabledInUi()).toBe(true);
  });

  it("hides local source when the public deploy target is Cloudflare", () => {
    vi.stubEnv("NEXT_PUBLIC_DEPLOY_TARGET", "cloudflare");

    expect(isLocalSourceEnabledInUi()).toBe(false);
  });

  it("hides local source when the server deploy target is Cloudflare", () => {
    vi.stubEnv("DEPLOY_TARGET", "cloudflare");

    expect(isLocalSourceEnabledInUi()).toBe(false);
  });

  it("hides cached source unless explicitly feature-gated on", () => {
    expect(isCachedSourceEnabledInUi()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_SCANNER_ENABLE_CACHED_SOURCE", "true");
    expect(isCachedSourceEnabledInUi()).toBe(true);
  });
});
