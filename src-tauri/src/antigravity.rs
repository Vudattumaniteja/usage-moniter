use std::process::Command;

/// Target Antigravity executable names on Windows.
pub const TARGET_PROCESS_NAMES: &[&str] = &[
    "language_server_windows_x64.exe",
    "agy.exe",
    "language_server.exe",
];

/// Extracts process IDs from `tasklist /FO CSV /NH` output matching target names.
pub fn parse_pids_from_tasklist_csv(csv_output: &str, target_names: &[&str]) -> Vec<u32> {
    let mut pids = Vec::new();
    for line in csv_output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // CSV format: "Image Name","PID","Session Name","Session#","Mem Usage"
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 2 {
            let image_name = parts[0].trim_matches('"').trim();
            let pid_str = parts[1].trim_matches('"').trim();

            let matches_target = target_names.iter().any(|&target| {
                image_name.eq_ignore_ascii_case(target)
            });

            if matches_target {
                if let Ok(pid) = pid_str.parse::<u32>() {
                    if !pids.contains(&pid) {
                        pids.push(pid);
                    }
                }
            }
        }
    }
    pids
}

/// Parses listening TCP loopback ports from `netstat -ano -p tcp` for given PIDs.
pub fn parse_listening_ports_from_netstat(netstat_output: &str, pids: &[u32]) -> Vec<u16> {
    let mut ports = Vec::new();
    for line in netstat_output.lines() {
        let line = line.trim();
        // Look for LISTENING rows
        if !line.contains("LISTENING") {
            continue;
        }

        // Format: TCP  127.0.0.1:58600  0.0.0.0:0  LISTENING  7688
        let tokens: Vec<&str> = line.split_whitespace().collect();
        if tokens.len() >= 5 && tokens[0].eq_ignore_ascii_case("TCP") {
            let local_addr = tokens[1];
            let owning_pid_str = tokens[tokens.len() - 1];

            if let Ok(owning_pid) = owning_pid_str.parse::<u32>() {
                if pids.contains(&owning_pid) {
                    // Extract port from local_addr (e.g. 127.0.0.1:58600 or [::]:58600)
                    if let Some(colon_idx) = local_addr.rfind(':') {
                        let port_str = &local_addr[colon_idx + 1..];
                        if let Ok(port) = port_str.parse::<u16>() {
                            if !ports.contains(&port) {
                                ports.push(port);
                            }
                        }
                    }
                }
            }
        }
    }
    ports
}

/// Extracts optional `--csrf_token <token>` from command line string.
pub fn extract_csrf_token(command_line: &str) -> Option<String> {
    let patterns = ["--csrf_token", "--csrf-token", "-csrf_token"];
    for pattern in patterns {
        if let Some(idx) = command_line.find(pattern) {
            let rest = &command_line[idx + pattern.len()..];
            let mut tokens = rest.split_whitespace();
            if let Some(token) = tokens.next() {
                let clean_token = token.trim_matches('"').trim_matches('\'').trim();
                if !clean_token.is_empty() && !clean_token.starts_with('-') {
                    return Some(clean_token.to_string());
                }
            }
        }
    }
    None
}

/// Discovers active PIDs of Antigravity or language server on Windows.
pub fn discover_antigravity_pids() -> Vec<u32> {
    let output = match Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .output()
    {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(_) => return Vec::new(),
    };

    parse_pids_from_tasklist_csv(&output, TARGET_PROCESS_NAMES)
}

/// Finds all listening loopback ports belonging to Antigravity processes.
pub fn discover_antigravity_listening_ports() -> Vec<u16> {
    let pids = discover_antigravity_pids();
    if pids.is_empty() {
        return Vec::new();
    }

    let output = match Command::new("netstat")
        .args(["-ano", "-p", "tcp"])
        .output()
    {
        Ok(out) => String::from_utf8_lossy(&out.stdout).to_string(),
        Err(_) => return Vec::new(),
    };

    parse_listening_ports_from_netstat(&output, &pids)
}

/// Queries Connect-RPC RetrieveUserQuotaSummary on a specific port.
pub fn query_port_retrieve_user_quota_summary(
    port: u16,
    csrf_token: Option<&str>,
) -> Result<String, String> {
    let endpoint_path = "/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary";
    let https_url = format!("https://127.0.0.1:{}{}", port, endpoint_path);
    let http_url = format!("http://127.0.0.1:{}{}", port, endpoint_path);

    // Try HTTPS first (Antigravity language server default)
    let mut args = vec![
        "-k".to_string(),
        "-s".to_string(),
        "--max-time".to_string(),
        "3".to_string(),
        "-X".to_string(),
        "POST".to_string(),
        https_url,
        "-H".to_string(),
        "Connect-Protocol-Version: 1".to_string(),
        "-H".to_string(),
        "Content-Type: application/json".to_string(),
        "-d".to_string(),
        "{}".to_string(),
    ];

    if let Some(token) = csrf_token {
        args.push("-H".to_string());
        args.push(format!("X-Codeium-Csrf-Token: {}", token));
    }

    let https_result = Command::new("curl.exe")
        .args(&args)
        .output();

    if let Ok(out) = https_result {
        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
        if out.status.success() && (stdout.contains("\"groups\"") || stdout.contains("\"response\"")) {
            return Ok(stdout);
        }
    }

    // Fallback to plain HTTP if HTTPS didn't respond with valid JSON
    args[6] = http_url;
    let http_result = Command::new("curl.exe")
        .args(&args)
        .output();

    if let Ok(out) = http_result {
        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
        if out.status.success() && (stdout.contains("\"groups\"") || stdout.contains("\"response\"")) {
            return Ok(stdout);
        }
    }

    Err(format!("Port {} did not return a valid Quota Summary response", port))
}

/// Discovers active Antigravity loopback port and queries quota summary.
pub fn get_antigravity_quota_summary() -> Result<Option<String>, String> {
    let ports = discover_antigravity_listening_ports();
    if ports.is_empty() {
        return Ok(None);
    }

    for &port in &ports {
        if let Ok(payload) = query_port_retrieve_user_quota_summary(port, None) {
            return Ok(Some(payload));
        }
    }

    Ok(None)
}

#[tauri::command]
pub fn get_antigravity_usage() -> Result<Option<String>, String> {
    get_antigravity_quota_summary()
}

#[tauri::command]
pub fn discover_antigravity_port() -> Result<Option<u16>, String> {
    let ports = discover_antigravity_listening_ports();
    for &port in &ports {
        if query_port_retrieve_user_quota_summary(port, None).is_ok() {
            return Ok(Some(port));
        }
    }
    Ok(ports.first().copied())
}

#[tauri::command]
pub fn query_antigravity_rpc(port: u16, csrf_token: Option<String>) -> Result<String, String> {
    query_port_retrieve_user_quota_summary(port, csrf_token.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_pids_from_tasklist_csv() {
        let sample_csv = r#""System Idle Process","0","Services","0","8 K"
"System","4","Services","0","284 K"
"agy.exe","22012","Console","1","259,720 K"
"language_server_windows_x64.exe","7688","Console","1","220,664 K"
"chrome.exe","14500","Console","1","150,000 K""#;

        let pids = parse_pids_from_tasklist_csv(sample_csv, TARGET_PROCESS_NAMES);
        assert_eq!(pids, vec![22012, 7688]);
    }

    #[test]
    fn test_parse_listening_ports_from_netstat() {
        let sample_netstat = r#"
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1200
  TCP    127.0.0.1:58600        0.0.0.0:0              LISTENING       7688
  TCP    127.0.0.1:58601        0.0.0.0:0              LISTENING       7688
  TCP    127.0.0.1:59661        0.0.0.0:0              LISTENING       22012
  TCP    127.0.0.1:49682        127.0.0.1:49683        ESTABLISHED     7688
  TCP    192.168.1.5:58603      34.54.84.110:443       ESTABLISHED     7688
"#;

        let pids = vec![7688, 22012];
        let ports = parse_listening_ports_from_netstat(sample_netstat, &pids);
        assert_eq!(ports, vec![58600, 58601, 59661]);
    }

    #[test]
    fn test_extract_csrf_token() {
        let cmd1 = r#""C:\path\language_server_windows_x64.exe" --csrf_token "abc-123-xyz" --app_data_dir "C:\temp""#;
        assert_eq!(extract_csrf_token(cmd1), Some("abc-123-xyz".to_string()));

        let cmd2 = r#""C:\path\language_server_windows_x64.exe" --csrf_token token_without_quotes --port 5000"#;
        assert_eq!(extract_csrf_token(cmd2), Some("token_without_quotes".to_string()));

        let cmd3 = r#""C:\path\agy.exe" daemon"#;
        assert_eq!(extract_csrf_token(cmd3), None);
    }
}
