use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CodexAuth {
    pub access_token: String,
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexUsageResponse {
    pub status: u16,
    pub body: String,
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
struct RawCodexTokens {
    access_token: Option<String>,
    account_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawCodexAuthFile {
    tokens: Option<RawCodexTokens>,
    access_token: Option<String>,
    account_id: Option<String>,
}

/// Resolves default path to `%USERPROFILE%\.codex\auth.json` on Windows / cross-platform.
pub fn get_default_codex_auth_path() -> PathBuf {
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        if !user_profile.trim().is_empty() {
            return PathBuf::from(user_profile).join(".codex").join("auth.json");
        }
    }

    if let Ok(home) = std::env::var("HOME") {
        if !home.trim().is_empty() {
            return PathBuf::from(home).join(".codex").join("auth.json");
        }
    }

    PathBuf::from(".codex").join("auth.json")
}

/// Parses auth credentials from raw string content.
pub fn parse_codex_auth_from_string(content: &str) -> Option<CodexAuth> {
    let parsed: RawCodexAuthFile = serde_json::from_str(content).ok()?;

    let token = parsed
        .tokens
        .as_ref()
        .and_then(|t| t.access_token.clone())
        .or(parsed.access_token)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())?;

    let account_id = parsed
        .tokens
        .as_ref()
        .and_then(|t| t.account_id.clone())
        .or(parsed.account_id)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    Some(CodexAuth {
        access_token: token,
        account_id,
    })
}

/// Reads and parses Codex auth credentials from disk.
pub fn read_codex_auth_from_disk(path: &PathBuf) -> Result<Option<CodexAuth>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read auth file {:?}: {}", path, e))?;

    Ok(parse_codex_auth_from_string(&content))
}

#[tauri::command]
pub fn load_codex_auth() -> Result<Option<CodexAuth>, String> {
    let path = get_default_codex_auth_path();
    read_codex_auth_from_disk(&path)
}

#[tauri::command]
pub fn fetch_codex_usage(
    access_token: String,
    account_id: Option<String>,
) -> Result<CodexUsageResponse, String> {
    let endpoint = "https://chatgpt.com/backend-api/wham/usage";

    let mut args = vec![
        "-s".to_string(),
        "-i".to_string(), // Include HTTP response headers in output
        "--max-time".to_string(),
        "10".to_string(),
        "-X".to_string(),
        "GET".to_string(),
        endpoint.to_string(),
        "-H".to_string(),
        format!("Authorization: Bearer {}", access_token),
        "-H".to_string(),
        "Accept: application/json".to_string(),
        "-H".to_string(),
        "User-Agent: usage-monitor/1.0".to_string(),
    ];

    if let Some(ref acc) = account_id {
        if !acc.trim().is_empty() {
            args.push("-H".to_string());
            args.push(format!("chatgpt-account-id: {}", acc.trim()));
        }
    }

    let output = Command::new("curl.exe")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    let full_response = String::from_utf8_lossy(&output.stdout).to_string();

    let mut status_code: u16 = 200;
    let mut headers = HashMap::new();
    let body: String;

    // Split headers and body by \r\n\r\n or \n\n
    let parts: Vec<&str> = full_response.splitn(2, "\r\n\r\n").collect();
    let header_part;
    if parts.len() == 2 {
        header_part = parts[0];
        body = parts[1].to_string();
    } else {
        let alt_parts: Vec<&str> = full_response.splitn(2, "\n\n").collect();
        if alt_parts.len() == 2 {
            header_part = alt_parts[0];
            body = alt_parts[1].to_string();
        } else {
            header_part = "";
            body = full_response.clone();
        }
    }

    for line in header_part.lines() {
        let line = line.trim();
        if line.starts_with("HTTP/") {
            let tokens: Vec<&str> = line.split_whitespace().collect();
            if tokens.len() >= 2 {
                if let Ok(code) = tokens[1].parse::<u16>() {
                    status_code = code;
                }
            }
        } else if let Some(colon_idx) = line.find(':') {
            let key = line[..colon_idx].trim().to_lowercase();
            let value = line[colon_idx + 1..].trim().to_string();
            headers.insert(key, value);
        }
    }

    Ok(CodexUsageResponse {
        status: status_code,
        body,
        headers: Some(headers),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_default_codex_auth_path() {
        let path = get_default_codex_auth_path();
        let path_str = path.to_string_lossy();
        assert!(path_str.contains(".codex"));
        assert!(path_str.ends_with("auth.json"));
    }

    #[test]
    fn test_parse_codex_auth_standard_format() {
        let json = r#"{
            "auth_mode": "chatgpt",
            "tokens": {
                "access_token": "token_12345",
                "refresh_token": "rt_67890",
                "account_id": "team_abc"
            }
        }"#;

        let auth = parse_codex_auth_from_string(json).expect("Should parse valid JSON");
        assert_eq!(auth.access_token, "token_12345");
        assert_eq!(auth.account_id, Some("team_abc".to_string()));
    }

    #[test]
    fn test_parse_codex_auth_flat_format() {
        let json = r#"{
            "access_token": "flat_tok_abc",
            "account_id": null
        }"#;

        let auth = parse_codex_auth_from_string(json).expect("Should parse valid flat JSON");
        assert_eq!(auth.access_token, "flat_tok_abc");
        assert_eq!(auth.account_id, None);
    }

    #[test]
    fn test_parse_codex_auth_invalid_or_missing() {
        assert_eq!(parse_codex_auth_from_string(""), None);
        assert_eq!(parse_codex_auth_from_string(r#"{"auth_mode":"none"}"#), None);
        assert_eq!(parse_codex_auth_from_string(r#"{"tokens":{"access_token":"  "}}"#), None);
    }
}
