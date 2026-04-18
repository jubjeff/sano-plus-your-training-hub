import { describe, expect, it, vi } from "vitest";
import { buildAuthCallbackUrl, sanitizeInternalRedirectPath } from "@/lib/auth-redirects";

describe("auth redirects", () => {
  it("keeps only internal redirect paths", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://sano.plus",
      },
    });

    expect(sanitizeInternalRedirectPath("/dashboard?tab=students", "/")).toBe("/dashboard?tab=students");
    expect(sanitizeInternalRedirectPath("https://evil.example/phish", "/")).toBe("/");

    vi.unstubAllGlobals();
  });

  it("builds callback URLs using the current app origin", () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://sano.plus",
      },
    });

    expect(buildAuthCallbackUrl("/dashboard")).toBe("https://sano.plus/auth/callback?next=%2Fdashboard");

    vi.unstubAllGlobals();
  });
});
