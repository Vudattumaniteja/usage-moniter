import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROTOTYPE_SNAPSHOTS,
  PROVIDER_METADATA,
  updateMockSnapshot,
  getMockProviderList,
} from "./mockData";

describe("mockData", () => {
  it("provides default snapshots for antigravity and codex", () => {
    expect(DEFAULT_PROTOTYPE_SNAPSHOTS.antigravity).toBeDefined();
    expect(DEFAULT_PROTOTYPE_SNAPSHOTS.codex).toBeDefined();

    expect(DEFAULT_PROTOTYPE_SNAPSHOTS.antigravity.provider).toBe("antigravity");
    expect(DEFAULT_PROTOTYPE_SNAPSHOTS.codex.provider).toBe("codex");
  });

  it("updates a snapshot safely with clamp limits", () => {
    const updated = updateMockSnapshot(DEFAULT_PROTOTYPE_SNAPSHOTS, "antigravity", {
      sessionUsedPercent: 95,
      status: "warning",
    });

    expect(updated.antigravity.sessionUsedPercent).toBe(95);
    expect(updated.antigravity.status).toBe("warning");
    expect(DEFAULT_PROTOTYPE_SNAPSHOTS.antigravity.sessionUsedPercent).not.toBe(95);
  });

  it("exposes rich metadata for each provider", () => {
    const providers = getMockProviderList(DEFAULT_PROTOTYPE_SNAPSHOTS);
    expect(providers.length).toBeGreaterThanOrEqual(2);

    const antigravityMeta = PROVIDER_METADATA.antigravity;
    expect(antigravityMeta.name).toContain("Antigravity");
    expect(antigravityMeta.brandColor).toBeDefined();
    expect(antigravityMeta.sessionWindowLabel).toBe("Current session (5h)");
  });
});
