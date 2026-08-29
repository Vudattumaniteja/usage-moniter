/**
 * Network connectivity monitor for Windows AI Usage Notch Monitor.
 * Detects online/offline transitions to pause remote polling and resume immediately on reconnect.
 */

export interface NetworkMonitorOptions {
  initialOnline?: boolean;
  autoStart?: boolean;
}

export class NetworkMonitor {
  private online: boolean;
  private subscribers: Set<(isOnline: boolean) => void> = new Set();
  private isListening: boolean = false;
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor(options: NetworkMonitorOptions = {}) {
    if (options.initialOnline !== undefined) {
      this.online = options.initialOnline;
    } else if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      this.online = navigator.onLine;
    } else {
      this.online = true;
    }

    this.onlineHandler = () => this.setOnline(true);
    this.offlineHandler = () => this.setOnline(false);

    if (options.autoStart !== false && typeof window !== "undefined") {
      this.startMonitoring();
    }
  }

  isOnline(): boolean {
    return this.online;
  }

  setOnline(status: boolean): void {
    if (this.online === status) return;
    this.online = status;
    this.notifySubscribers();
  }

  subscribe(listener: (isOnline: boolean) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  startMonitoring(): void {
    if (this.isListening || typeof window === "undefined") return;
    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);
    this.isListening = true;
  }

  stopMonitoring(): void {
    if (!this.isListening || typeof window === "undefined") return;
    window.removeEventListener("online", this.onlineHandler);
    window.removeEventListener("offline", this.offlineHandler);
    this.isListening = false;
  }

  private notifySubscribers(): void {
    for (const listener of this.subscribers) {
      try {
        listener(this.online);
      } catch (err) {
        console.error("Error in NetworkMonitor subscriber:", err);
      }
    }
  }
}

export const defaultNetworkMonitor = new NetworkMonitor();
