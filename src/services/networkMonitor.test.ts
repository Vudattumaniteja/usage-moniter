import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NetworkMonitor } from "./networkMonitor";

describe("NetworkMonitor", () => {
  let monitor: NetworkMonitor;

  beforeEach(() => {
    monitor = new NetworkMonitor({ initialOnline: true });
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  it("initializes with provided online state", () => {
    expect(monitor.isOnline()).toBe(true);

    const offlineMon = new NetworkMonitor({ initialOnline: false });
    expect(offlineMon.isOnline()).toBe(false);
  });

  it("updates state and notifies subscribers when transitioning offline and online", () => {
    const subscriber = vi.fn();
    const unsub = monitor.subscribe(subscriber);

    monitor.setOnline(false);
    expect(monitor.isOnline()).toBe(false);
    expect(subscriber).toHaveBeenCalledWith(false);

    monitor.setOnline(true);
    expect(monitor.isOnline()).toBe(true);
    expect(subscriber).toHaveBeenCalledWith(true);

    unsub();
  });

  it("does not duplicate notifications when state does not change", () => {
    const subscriber = vi.fn();
    monitor.subscribe(subscriber);

    monitor.setOnline(true);
    expect(subscriber).not.toHaveBeenCalled();

    monitor.setOnline(false);
    expect(subscriber).toHaveBeenCalledTimes(1);

    monitor.setOnline(false);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("responds to window online/offline DOM events", () => {
    const subscriber = vi.fn();
    monitor.startMonitoring();
    monitor.subscribe(subscriber);

    // Simulate offline event
    window.dispatchEvent(new Event("offline"));
    expect(monitor.isOnline()).toBe(false);
    expect(subscriber).toHaveBeenCalledWith(false);

    // Simulate online event
    window.dispatchEvent(new Event("online"));
    expect(monitor.isOnline()).toBe(true);
    expect(subscriber).toHaveBeenCalledWith(true);
  });
});
