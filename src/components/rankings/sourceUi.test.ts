import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isCachedSourceEnabledInUi, isLocalSourceEnabledInUi } from "./sourceUi";

const ORIGINAL_ENV = { ...process.env };
const SOURCE_UI_ENV_KEYS = [
  "NEXT_PUBLIC_DEPLOY_TARGET",
  "DEPLOY_TARGET",
  "NEXT_PUBLIC_SCANNER_ENABLE_CACHED_SOURCE",
] as const;

describe("rankings source UI", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };

    for (const key of SOURCE_UI_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    process.env = ORIGINAL_ENV;
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
