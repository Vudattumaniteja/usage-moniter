import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseCodexAuthContent,
  getDefaultCodexAuthPath,
  loadCodexAuthFromFile,
  CodexAuthWatcher,
} from "./codexAuth";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Codex Auth Extraction & Validation", () => {
  let tempDir: string;
  let authFilePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex_auth_test_"));
    const codexDir = path.join(tempDir, ".codex");
    fs.mkdirSync(codexDir, { recursive: true });
    authFilePath = path.join(codexDir, "auth.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("parseCodexAuthContent", () => {
    it("parses valid standard Codex CLI auth.json format", () => {
      const sample = JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          access_token: "eyJhbGciOiJSUzI1NiIs.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig",
          refresh_token: "rt_abc123",
          id_token: "id_tok",
          account_id: "org_workspace_456",
        },
      });

      const creds = parseCodexAuthContent(sample, "C:\\Users\\test\\.codex\\auth.json");
      expect(creds).toEqual({
        accessToken: "eyJhbGciOiJSUzI1NiIs.eyJzdWIiOiJ1c2VyLTEyMyJ9.sig",
        accountId: "org_workspace_456",
        authPath: "C:\\Users\\test\\.codex\\auth.json",
      });
    });

    it("parses flat auth.json structure with top-level access_token", () => {
      const sample = JSON.stringify({
        access_token: "secret_token_abc",
        account_id: "acc_999",
      });

      const creds = parseCodexAuthContent(sample);
      expect(creds?.accessToken).toBe("secret_token_abc");
      expect(creds?.accountId).toBe("acc_999");
    });

    it("returns null for invalid JSON or empty content", () => {
      expect(parseCodexAuthContent("")).toBeNull();
      expect(parseCodexAuthContent("invalid json { [")).toBeNull();
      expect(parseCodexAuthContent(null as unknown as string)).toBeNull();
    });

    it("returns null when access_token is missing or empty string", () => {
      const noToken = JSON.stringify({
        auth_mode: "chatgpt",
        tokens: {
          refresh_token: "rt_123",
        },
      });
      expect(parseCodexAuthContent(noToken)).toBeNull();

      const emptyToken = JSON.stringify({
        tokens: {
          access_token: "   ",
        },
      });
      expect(parseCodexAuthContent(emptyToken)).toBeNull();
    });
  });

  describe("getDefaultCodexAuthPath", () => {
    it("resolves default path based on USERPROFILE or HOME environment variable", () => {
      const originalUserProfile = process.env.USERPROFILE;
      try {
        process.env.USERPROFILE = "C:\\Users\\Manit";
        const authPath = getDefaultCodexAuthPath();
        expect(authPath).toContain(".codex");
        expect(authPath).toContain("auth.json");
      } finally {
        process.env.USERPROFILE = originalUserProfile;
      }
    });
  });

  describe("loadCodexAuthFromFile", () => {
    it("loads and parses auth credentials from file path", () => {
      const authData = {
        auth_mode: "chatgpt",
        tokens: {
          access_token: "live_access_token_xyz",
          account_id: "team_789",
        },
      };
      fs.writeFileSync(authFilePath, JSON.stringify(authData));

      const creds = loadCodexAuthFromFile(authFilePath);
      expect(creds).not.toBeNull();
      expect(creds?.accessToken).toBe("live_access_token_xyz");
      expect(creds?.accountId).toBe("team_789");
    });

    it("returns null when file does not exist", () => {
      const nonExistentPath = path.join(tempDir, "non_existent", "auth.json");
      const creds = loadCodexAuthFromFile(nonExistentPath);
      expect(creds).toBeNull();
    });
  });

  describe("CodexAuthWatcher", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("notifies subscriber when auth file is created or updated with new token", () => {
      const onAuthChanged = vi.fn();
      const watcher = new CodexAuthWatcher({
        authPath: authFilePath,
        pollIntervalMs: 500,
      });

      watcher.subscribe(onAuthChanged);
      watcher.startWatching();

      // Write token to file
      const authData = {
        tokens: {
          access_token: "initial_token",
        },
      };
      fs.writeFileSync(authFilePath, JSON.stringify(authData));

      // Advance timer for watcher check
      vi.advanceTimersByTime(550);
      expect(onAuthChanged).toHaveBeenCalledTimes(1);
      expect(onAuthChanged).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: "initial_token" })
      );

      // Update file with new refreshed token
      const refreshedData = {
        tokens: {
          access_token: "refreshed_token_2",
        },
      };
      fs.writeFileSync(authFilePath, JSON.stringify(refreshedData));

      vi.advanceTimersByTime(550);
      expect(onAuthChanged).toHaveBeenCalledTimes(2);
      expect(onAuthChanged).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: "refreshed_token_2" })
      );

      watcher.stopWatching();
    });
  });
});
