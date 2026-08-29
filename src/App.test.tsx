import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { App } from "./App";
import * as windowDocking from "./services/windowDocking";
import { antigravityAdapter } from "./services/antigravityAdapter";
import { codexAdapter } from "./services/codexAdapter";

describe("App System Integration", () => {
  beforeEach(() => {
    vi.spyOn(windowDocking, "dockOverlayWindow").mockResolvedValue({
      x: 1560,
      y: 250,
      width: 360,
      height: 580,
    });

    vi.spyOn(antigravityAdapter, "startPolling").mockImplementation(() => {});
    vi.spyOn(antigravityAdapter, "stopPolling").mockImplementation(() => {});
    vi.spyOn(codexAdapter, "startPolling").mockImplementation(() => {});
    vi.spyOn(codexAdapter, "stopPolling").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attempts to dock the overlay window pinned to the right edge on mount", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(windowDocking.dockOverlayWindow).toHaveBeenCalled();
  });

  it("renders Variant A by default and displays both provider usage rings", async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText("Organic Curve Notch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Antigravity Usage: 68%/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Codex \/ ChatGPT: 86%/i })).toBeInTheDocument();
  });

  it("triggers on-demand refresh when hovering over a usage ring", async () => {
    const refreshSpy = vi.spyOn(antigravityAdapter, "refreshNow").mockResolvedValue({
      provider: "antigravity",
      sessionUsedPercent: 35,
      sessionResetTime: Date.now() + 10000,
      status: "ok",
    });

    await act(async () => {
      render(<App />);
    });

    const antigravityRing = screen.getByRole("button", { name: /Antigravity Usage: 68%/i });
    await act(async () => {
      fireEvent.mouseEnter(antigravityRing);
    });

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });
});
