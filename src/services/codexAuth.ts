export interface CodexAuthCredentials {
  accessToken: string;
  accountId?: string;
  authPath?: string;
}

export interface CodexTokens {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  account_id?: string;
}

export interface CodexRawAuthFile {
  auth_mode?: string;
  tokens?: CodexTokens;
  access_token?: string;
  account_id?: string;
}

function getFsModule(): typeof import("node:fs") | null {
  try {
    if (typeof process !== "undefined" && process.versions?.node) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require("node:fs");
    }
  } catch {
    // Browser or Vite client bundle
  }
  return null;
}

/**
 * Returns default path to Codex CLI auth file `%USERPROFILE%\.codex\auth.json`.
 */
export function getDefaultCodexAuthPath(): string {
  const userProfile =
    (typeof process !== "undefined" && process.env?.USERPROFILE) ||
    (typeof process !== "undefined" && process.env?.HOME) ||
    "";

  if (userProfile) {
    const isWindows =
      userProfile.includes("\\") ||
      (typeof process !== "undefined" && process.platform === "win32");
    const sep = isWindows ? "\\" : "/";
    const cleanProfile = userProfile.replace(/[\\/]+$/, "");
    return `${cleanProfile}${sep}.codex${sep}auth.json`;
  }

  return ".codex/auth.json";
}

/**
 * Parses and validates raw auth.json string content.
 */
export function parseCodexAuthContent(
  content: string,
  filePath?: string
): CodexAuthCredentials | null {
  if (!content || typeof content !== "string" || !content.trim()) {
    return null;
  }

  try {
    const data = JSON.parse(content) as CodexRawAuthFile;
    const token =
      data.tokens?.access_token?.trim() || data.access_token?.trim();

    if (!token) {
      return null;
    }

    const accountId =
      data.tokens?.account_id?.trim() || data.account_id?.trim() || undefined;

    return {
      accessToken: token,
      accountId,
      authPath: filePath,
    };
  } catch {
    return null;
  }
}

/**
 * Loads and parses Codex credentials from a file path using filesystem operations.
 */
export function loadCodexAuthFromFile(
  filePath: string = getDefaultCodexAuthPath()
): CodexAuthCredentials | null {
  try {
    const fsMod = getFsModule();
    if (!fsMod || !fsMod.existsSync(filePath)) {
      return null;
    }
    const content = fsMod.readFileSync(filePath, "utf-8");
    return parseCodexAuthContent(content, filePath);
  } catch {
    return null;
  }
}

export interface CodexAuthWatcherOptions {
  authPath?: string;
  pollIntervalMs?: number;
}

/**
 * Watches the Codex auth file for modifications or creation,
 * triggering callbacks when a valid token is updated or refreshed.
 */
export class CodexAuthWatcher {
  private authPath: string;
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | number | null = null;
  private lastToken: string | null = null;
  private subscribers: Set<(creds: CodexAuthCredentials) => void> = new Set();
  private isWatching: boolean = false;

  constructor(options: CodexAuthWatcherOptions = {}) {
    this.authPath = options.authPath || getDefaultCodexAuthPath();
    this.pollIntervalMs = options.pollIntervalMs || 1000;
  }

  subscribe(listener: (creds: CodexAuthCredentials) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  startWatching(): void {
    if (this.isWatching) return;
    this.isWatching = true;

    // Check initial state
    const current = loadCodexAuthFromFile(this.authPath);
    if (current) {
      this.lastToken = current.accessToken;
    }

    this.scheduleCheck();
  }

  private scheduleCheck(): void {
    if (!this.isWatching) return;

    this.timer = setTimeout(() => {
      this.checkFile();
      if (this.isWatching) {
        this.scheduleCheck();
      }
    }, this.pollIntervalMs);
  }

  private checkFile(): void {
    const creds = loadCodexAuthFromFile(this.authPath);
    if (creds && creds.accessToken && creds.accessToken !== this.lastToken) {
      this.lastToken = creds.accessToken;
      for (const listener of this.subscribers) {
        try {
          listener(creds);
        } catch (err) {
          console.error("Error in CodexAuthWatcher listener:", err);
        }
      }
    }
  }

  stopWatching(): void {
    this.isWatching = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
