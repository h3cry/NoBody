#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use sysinfo::{Networks, System};
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
struct SystemInfo {
    hostname: String,
    os_name: String,
    os_version: String,
    cpu_usage: f32,
    memory_used_gb: f64,
    memory_total_gb: f64,
}

#[derive(Serialize)]
struct DiskInfo {
    name: String,
    total_gb: f64,
    available_gb: f64,
    used_percent: f64,
}

#[derive(Serialize)]
struct ProcessInfo {
    pid: String,
    name: String,
    cpu_usage: f32,
    memory_mb: f64,
}

#[derive(Serialize)]
struct NetworkInfo {
    download_mbps: f64,
    upload_mbps: f64,
    total_received_mb: f64,
    total_transmitted_mb: f64,
}

#[derive(Serialize)]
struct NetworkAdapter {
    name: String,
    ip_address: String,
    address_type: String,
    mac_address: String,
    connected: bool,
}

#[derive(Serialize)]
struct PingInfo {
    host: String,
    reachable: bool,
    latency_ms: Option<f64>,
}

#[derive(Serialize)]
struct SystemMonitor {
    cpu_usage: f32,
    cpu_cores: usize,
    memory_used_gb: f64,
    memory_total_gb: f64,
    memory_percent: f64,
    disks: Vec<DiskInfo>,
    network: NetworkInfo,
    processes: Vec<ProcessInfo>,
}

#[derive(Default)]
struct NetworkSnapshot {
    received: u64,
    transmitted: u64,
    time: Option<Instant>,
}

static NETWORK_STATE: OnceLock<Mutex<NetworkSnapshot>> = OnceLock::new();

#[derive(Serialize, Deserialize, Clone)]
struct Device {
    id: i64,
    name: String,
    hostname: String,
    os: String,
    status: String,
    #[serde(rename = "type")]
    device_type: String,
    added: String,
}

fn database_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;

    Ok(directory.join("nobody.db"))
}

fn database_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    Connection::open(path).map_err(|e| e.to_string())
}
fn write_activity_log(
    app: &AppHandle,
    level: &str,
    message: &str,
) -> Result<(), String> {
    use std::io::Write;

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&directory)
        .map_err(|e| e.to_string())?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let path = directory.join("activity.log");

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;

    writeln!(
        file,
        "{}|{}|{}",
        timestamp,
        level,
        message
    )
    .map_err(|e| e.to_string())
}
fn init_database(app: &AppHandle) -> Result<(), String> {
    let connection = database_connection(app)?;

    connection.execute(
        "CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            hostname TEXT NOT NULL,
            os TEXT NOT NULL,
            status TEXT NOT NULL,
            device_type TEXT NOT NULL,
            added TEXT NOT NULL
        )",
        [],
    ).map_err(|e| e.to_string())?;

    connection.execute("DROP TABLE IF EXISTS pairing_codes", [])
        .map_err(|e| e.to_string())?;

    let system = get_system_info();

    connection.execute(
        "INSERT OR IGNORE INTO devices
        (id, name, hostname, os, status, device_type, added)
        VALUES (1, 'Local Workstation', ?1, ?2, 'Online', 'Desktop', 'Local device')",
        params![
            system.hostname,
            format!("{} {}", system.os_name, system.os_version)
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let mut system = System::new_all();
    system.refresh_all();

    SystemInfo {
        hostname: System::host_name().unwrap_or_else(|| "Unknown".into()),
        os_name: System::name().unwrap_or_else(|| "Windows".into()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".into()),
        cpu_usage: system.global_cpu_info().cpu_usage(),
        memory_used_gb: system.used_memory() as f64 / 1_073_741_824.0,
        memory_total_gb: system.total_memory() as f64 / 1_073_741_824.0,
    }
}

#[tauri::command]
fn get_system_monitor() -> SystemMonitor {
    let mut system = System::new_all();
    system.refresh_all();

    let cpu_usage = system.global_cpu_info().cpu_usage();
    let cpu_cores = system.cpus().len();

    let memory_total = system.total_memory();
    let memory_used = system.used_memory();

    let memory_total_gb = memory_total as f64 / 1_073_741_824.0;
    let memory_used_gb = memory_used as f64 / 1_073_741_824.0;

    let memory_percent = if memory_total > 0 {
        memory_used as f64 / memory_total as f64 * 100.0
    } else {
        0.0
    };

    let disks = sysinfo::Disks::new_with_refreshed_list();

    let disk_info: Vec<DiskInfo> = disks
        .iter()
        .map(|disk| {
            let total = disk.total_space();
            let available = disk.available_space();

            let used_percent = if total > 0 {
                (total - available) as f64 / total as f64 * 100.0
            } else {
                0.0
            };

            DiskInfo {
                name: disk.mount_point().to_string_lossy().to_string(),
                total_gb: total as f64 / 1_073_741_824.0,
                available_gb: available as f64 / 1_073_741_824.0,
                used_percent,
            }
        })
        .collect();

    let networks = Networks::new_with_refreshed_list();

    let received: u64 = networks
        .iter()
        .map(|(_, data)| data.total_received())
        .sum();

    let transmitted: u64 = networks
        .iter()
        .map(|(_, data)| data.total_transmitted())
        .sum();

    let network_state =
        NETWORK_STATE.get_or_init(|| Mutex::new(NetworkSnapshot::default()));

    let mut state = network_state.lock().unwrap();
    let now = Instant::now();

    let (download_mbps, upload_mbps) = if let Some(previous_time) = state.time {
        let elapsed = now.duration_since(previous_time).as_secs_f64();

        if elapsed > 0.0 {
            let download = received.saturating_sub(state.received) as f64
                * 8.0 / elapsed / 1_000_000.0;

            let upload = transmitted.saturating_sub(state.transmitted) as f64
                * 8.0 / elapsed / 1_000_000.0;

            (download, upload)
        } else {
            (0.0, 0.0)
        }
    } else {
        (0.0, 0.0)
    };

    state.received = received;
    state.transmitted = transmitted;
    state.time = Some(now);

    let network_info = NetworkInfo {
        download_mbps,
        upload_mbps,
        total_received_mb: received as f64 / 1_048_576.0,
        total_transmitted_mb: transmitted as f64 / 1_048_576.0,
    };

    drop(state);

    let mut processes: Vec<ProcessInfo> = system
        .processes()
        .iter()
        .map(|(pid, process)| ProcessInfo {
            pid: pid.to_string(),
            name: process.name().to_string(),
            cpu_usage: process.cpu_usage(),
            memory_mb: process.memory() as f64 / 1_048_576.0,
        })
        .collect();

    processes.sort_by(|a, b| {
        b.cpu_usage
            .partial_cmp(&a.cpu_usage)
            .unwrap_or(Ordering::Equal)
    });

    processes.truncate(15);

    SystemMonitor {
        cpu_usage,
        cpu_cores,
        memory_used_gb,
        memory_total_gb,
        memory_percent,
        disks: disk_info,
        network: network_info,
        processes,
    }
}

#[tauri::command]
fn get_ping_status() -> PingInfo {
    use std::process::Command;

    let host = "1.1.1.1";

    let output = Command::new("ping")
    .args(["-n", "1", "-w", "1500", host])
    .creation_flags(CREATE_NO_WINDOW)
    .output();

    match output {
        Ok(result) if result.status.success() => {
            let response = String::from_utf8_lossy(&result.stdout);

            let latency_ms = response
                .split_whitespace()
                .find_map(|part| {
                    if let Some(value) = part.strip_prefix("time=") {
                        value.trim_end_matches("ms").parse::<f64>().ok()
                    } else if part.starts_with("time<") {
                        Some(0.5)
                    } else {
                        None
                    }
                });

            PingInfo {
                host: host.to_string(),
                reachable: latency_ms.is_some(),
                latency_ms,
            }
        }
        _ => PingInfo {
            host: host.to_string(),
            reachable: false,
            latency_ms: None,
        },
    }
}

#[tauri::command]
fn get_network_adapters() -> Result<Vec<NetworkAdapter>, String> {
    use get_if_addrs::{get_if_addrs, IfAddr};
    use std::process::Command;
    use serde::Deserialize;

    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct AdapterInfo {
        interface_guid: Option<String>,
        name: Option<String>,
        mac_address: Option<String>,
        status: Option<String>,
    }

    let output = Command::new("powershell")
    .args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-NetAdapter | Select-Object InterfaceGuid,Name,MacAddress,Status | ConvertTo-Json -Compress"
    ])
    .creation_flags(CREATE_NO_WINDOW)
    .output()
        .map_err(|e| format!("Adapter information error: {}", e))?;

    let adapter_data = String::from_utf8_lossy(&output.stdout);

    let adapter_list: Vec<AdapterInfo> =
        if adapter_data.trim().is_empty() {
            Vec::new()
        } else if adapter_data.trim_start().starts_with('[') {
            serde_json::from_str(&adapter_data).unwrap_or_default()
        } else {
            serde_json::from_str::<AdapterInfo>(&adapter_data)
                .map(|a| vec![a])
                .unwrap_or_default()
        };

    let interfaces = get_if_addrs().map_err(|e| e.to_string())?;
    let mut adapters = Vec::new();

    for interface in interfaces {
        let (ip_address, address_type, connected) = match interface.addr {
            IfAddr::V4(addr) => {
                let ip = addr.ip;
                (
                    ip.to_string(),
                    "IPv4".to_string(),
                    !ip.is_loopback() && !ip.is_unspecified(),
                )
            }
            IfAddr::V6(addr) => {
                let ip = addr.ip;
                (
                    ip.to_string(),
                    "IPv6".to_string(),
                    !ip.is_loopback() && !ip.is_unspecified(),
                )
            }
        };

        if !connected {
            continue;
        }

        let normalize = |value: &str| {
            value
                .trim()
                .trim_matches('{')
                .trim_matches('}')
                .to_lowercase()
        };

        let adapter = adapter_list.iter().find(|adapter| {
            adapter.interface_guid.as_deref()
                .map(|guid| normalize(guid) == normalize(&interface.name))
                .unwrap_or(false)
        });

        let name = adapter
            .and_then(|a| a.name.clone())
            .unwrap_or_else(|| interface.name.clone());

        let mac_address = adapter
            .and_then(|a| a.mac_address.clone())
            .filter(|mac| !mac.is_empty())
            .unwrap_or_else(|| "Unavailable".to_string());

        let connected = adapter
            .and_then(|a| a.status.as_deref())
            .map(|status| status == "Up")
            .unwrap_or(true);

        adapters.push(NetworkAdapter {
            name,
            ip_address,
            address_type,
            mac_address,
            connected,
        });
    }

    Ok(adapters)
}
#[derive(serde::Serialize, serde::Deserialize)]
struct CloudDevice {
    id: String,
    name: String,
    status: String,
}

#[tauri::command]
async fn get_cloud_devices() -> Result<Vec<CloudDevice>, String> {
    let key = std::env::var("NOBODY_ADMIN_KEY")
        .map_err(|_| "NOBODY_ADMIN_KEY is not configured".to_string())?;

    let response = reqwest::Client::new()
        .get("http://127.0.0.1:8765/devices")
        .header("x-admin-key", key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Cloud API error: {}", response.status()));
    }

    response.json::<Vec<CloudDevice>>()
        .await
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn delete_cloud_device(id: String) -> Result<(), String> {
    let key = std::env::var("NOBODY_ADMIN_KEY")
        .map_err(|_| "NOBODY_ADMIN_KEY is not configured".to_string())?;

    let device_id = uuid::Uuid::parse_str(&id)
        .map_err(|_| "Invalid device ID".to_string())?;

    let response = reqwest::Client::new()
        .delete(format!(
            "http://127.0.0.1:8765/devices/{device_id}"
        ))
        .header("x-admin-key", key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to delete cloud device: {}",
            response.status()
        ));
    }

    Ok(())
}
#[derive(serde::Serialize)]
struct ActivityLog {
    timestamp: String,
    level: String,
    message: String,
}

#[tauri::command]
fn get_activity_logs(app: AppHandle) -> Result<Vec<ActivityLog>, String> {
    let log_path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("activity.log");

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(log_path)
        .map_err(|e| e.to_string())?;

    let logs = content
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(3, '|');
            Some(ActivityLog {
                timestamp: parts.next()?.to_string(),
                level: parts.next()?.to_string(),
                message: parts.next()?.to_string(),
            })
        })
        .collect();

    Ok(logs)
}
#[tauri::command]
fn get_devices(app: AppHandle) -> Result<Vec<Device>, String> {
    let connection = database_connection(&app)?;

    let mut statement = connection.prepare(
        "SELECT id, name, hostname, os, status, device_type, added
         FROM devices ORDER BY id ASC"
    ).map_err(|e| e.to_string())?;

    let rows = statement.query_map([], |row| {
        Ok(Device {
            id: row.get(0)?,
            name: row.get(1)?,
            hostname: row.get(2)?,
            os: row.get(3)?,
            status: row.get(4)?,
            device_type: row.get(5)?,
            added: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut devices = Vec::new();

    for device in rows {
        devices.push(device.map_err(|e| e.to_string())?);
    }

    Ok(devices)
}

#[tauri::command]
fn add_device(
    app: AppHandle,
    name: String,
    hostname: String,
    os: String,
) -> Result<Device, String> {
    if name.trim().is_empty() || hostname.trim().is_empty() {
        return Err("Device name and hostname are required.".into());
    }

    let connection = database_connection(&app)?;

    let added = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs()
        .to_string();

    connection.execute(
        "INSERT INTO devices
         (name, hostname, os, status, device_type, added)
         VALUES (?1, ?2, ?3, 'Pending', 'Computer', ?4)",
        params![name.trim(), hostname.trim(), os.trim(), added],
    ).map_err(|e| e.to_string())?;

    let id = connection.last_insert_rowid();
write_activity_log(
    &app,
    "INFO",
    &format!("Device added: {} (ID: {})", name, id),
)?;
    Ok(Device {
        id,
        name,
        hostname,
        os,
        status: "Pending".into(),
        device_type: "Computer".into(),
        added,
    })
}

#[tauri::command]
fn remove_device(app: AppHandle, id: i64) -> Result<(), String> {
    if id == 1 {
        return Err("The local workstation cannot be removed.".into());
    }

    let connection = database_connection(&app)?;

    let affected = connection.execute(
        "DELETE FROM devices WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Device not found.".into());
    }
write_activity_log(
    &app,
    "WARNING",
    &format!("Device removed (ID: {})", id),
)?;
    Ok(())
}

use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(Serialize)]
struct NetworkDiagnostics {
    gateway: String,
    dns_servers: Vec<String>,
    internet_available: bool,
}

#[tauri::command]
fn get_network_diagnostics() -> NetworkDiagnostics {
    use std::process::Command;

    let gateway = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1 -ExpandProperty NextHop"
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unavailable".to_string());

    let dns_servers = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-DnsClientServerAddress -AddressFamily IPv4 | ForEach-Object {$_.ServerAddresses} | Where-Object {$_} | Sort-Object -Unique"
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let internet_available = TcpStream::connect_timeout(
        &"1.1.1.1:443".parse().unwrap(),
        Duration::from_secs(2),
    ).is_ok();

    NetworkDiagnostics {
        gateway,
        dns_servers,
        internet_available,
    }
}

#[tauri::command]
fn dns_lookup(host: String) -> Vec<String> {
    let host = host.trim();

    if host.is_empty()
        || host.len() > 253
        || !host.chars().all(|c| {
            c.is_ascii_alphanumeric() || c == '.' || c == '-'
        })
    {
        return Vec::new();
    }

    (host, 0)
        .to_socket_addrs()
        .map(|addresses| {
            addresses
                .map(|a| a.ip().to_string())
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
fn run_traceroute(host: String) -> Vec<String> {
    let host = host.trim().to_string();

    if host.is_empty()
        || host.len() > 253
        || !host.chars().all(|c| {
            c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == ':'
        })
    {
        return vec!["Invalid hostname or IP address.".to_string()];
    }

    match std::process::Command::new("tracert")
    .args(["-d", "-h", "12", "-w", "800", &host])
    .creation_flags(CREATE_NO_WINDOW)
    .output()
    {
        Ok(output) => String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect(),
        Err(error) => vec![format!("Traceroute error: {}", error)],
    }
}

#[derive(Serialize)]
struct ActiveConnection {
    protocol: String,
    local_address: String,
    remote_address: String,
    state: String,
    pid: u32,
    process_name: String,
}

#[tauri::command]
fn get_active_connections() -> Vec<ActiveConnection> {
    use std::process::Command;
let output = match Command::new("netstat")
    .args(["-ano"])
    .creation_flags(CREATE_NO_WINDOW)
    .output()
    {
        Ok(output) => output,
        Err(_) => return Vec::new(),
    };

    let mut system = System::new_all();
    system.refresh_all();

    let mut connections = Vec::new();
    let text = String::from_utf8_lossy(&output.stdout);

    for line in text.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();

        if parts.is_empty() {
            continue;
        }

        let protocol = parts[0];

        let (local_address, remote_address, state, pid_index) =
            match protocol {
                "TCP" if parts.len() >= 5 => (
                    parts[1],
                    parts[2],
                    parts[3],
                    4,
                ),
                "UDP" if parts.len() >= 4 => (
                    parts[1],
                    parts[2],
                    "BOUND",
                    3,
                ),
                _ => continue,
            };

        let pid = match parts[pid_index].parse::<u32>() {
            Ok(pid) => pid,
            Err(_) => continue,
        };

        let process_name = system
            .processes()
            .iter()
            .find(|(process_id, _)| process_id.as_u32() == pid)
            .map(|(_, process)| process.name().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        connections.push(ActiveConnection {
            protocol: protocol.to_string(),
            local_address: local_address.to_string(),
            remote_address: remote_address.to_string(),
            state: state.to_string(),
            pid,
            process_name,
        });
    }

    connections
}

#[derive(serde::Serialize)]
struct WindowsSecurityStatus {
    firewall_enabled: Option<bool>,
    antivirus_enabled: Option<bool>,
    realtime_protection_enabled: Option<bool>,
}

fn read_windows_security(command: &str) -> Option<bool> {
    use std::process::Command;

    let output = Command::new("powershell.exe")
    .args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        command,
    ])
    .creation_flags(CREATE_NO_WINDOW)
    .output()
    .ok()?;

    if !output.status.success() {
        return None;
    }

    let result = String::from_utf8_lossy(&output.stdout);
    match result.trim().to_ascii_lowercase().as_str() {
        "true" => Some(true),
        "false" => Some(false),
        _ => None,
    }
}


#[tauri::command]
async fn build_agent(agent_name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::process::Command;

        let agent_dir = std::path::Path::new("C:\\nobody\\agent");

        if !agent_dir.join("Cargo.toml").exists() {
            return Err("Agent project not found".to_string());
        }

        let output = Command::new("cargo")
            .args(["build", "--release"])
            .current_dir(agent_dir)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let source = agent_dir.join("target\\release\\agent.exe");

        if !source.exists() {
            return Err("Agent executable not found".to_string());
        }

        // Allow only safe filename characters.
        let safe_name: String = agent_name
            .trim()
            .trim_end_matches(".exe")
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
            .take(40)
            .collect();

        if safe_name.is_empty() {
            return Err("Enter a valid agent name".to_string());
        }

        let destination = agent_dir.join(format!(
            "{}-NOBODY-Agent.exe",
            safe_name
        ));

        std::fs::copy(&source, &destination)
            .map_err(|e| e.to_string())?;

        Ok(destination.display().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}


#[derive(serde::Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    size: u64,
}

#[tauri::command]
fn list_local_files(path: String) -> Result<Vec<FileEntry>, String> {
    let directory = std::path::PathBuf::from(&path);

    if !directory.is_dir() {
        return Err("Directory not found".to_string());
    }

    let mut files = Vec::new();

    for item in std::fs::read_dir(&directory)
        .map_err(|e| e.to_string())?
    {
        let item = item.map_err(|e| e.to_string())?;
        let metadata = item.metadata().map_err(|e| e.to_string())?;

        files.push(FileEntry {
            name: item.file_name().to_string_lossy().to_string(),
            path: item.path().to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            size: metadata.len(),
        });
    }

    files.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(files)
}

#[tauri::command]
fn run_local_diagnostic(command: String) -> Result<String, String> {
    use std::process::Command;

    let (program, args): (&str, Vec<&str>) = match command.as_str() {
        "whoami" => ("whoami", vec![]),
        "hostname" => ("hostname", vec![]),
        "ipconfig" => ("ipconfig", vec![]),
        "ping" => ("ping", vec!["-n", "4", "1.1.1.1"]),
        _ => return Err("Unsupported diagnostic command".into()),
    };

    let output = Command::new(program)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    Ok(format!("{}{}", stdout, stderr))
}

#[tauri::command]
async fn close_remote_session(session_id: String) -> Result<(), String> {
    let key = std::fs::read_to_string(r"C:\nobody\admin-key.txt")
        .map_err(|e| e.to_string())?;

    let session_id = uuid::Uuid::parse_str(&session_id)
        .map_err(|_| "Invalid session ID".to_string())?;

    let response = reqwest::Client::new()
        .post(format!(
            "http://127.0.0.1:8765/remote/sessions/{session_id}/close"
        ))
        .header("x-admin-key", key.trim())
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Close failed: {}", response.status()));
    }

    Ok(())
}
#[tauri::command]
async fn get_windows_security_status() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let script = r#"
            $ErrorActionPreference = 'SilentlyContinue'

            $mp  = Get-MpComputerStatus
            $fw  = @(Get-NetFirewallProfile)
            $os  = Get-CimInstance Win32_OperatingSystem
            $bl  = Get-BitLockerVolume -MountPoint $env:SystemDrive
            $av  = Get-CimInstance `
                     -Namespace 'root/SecurityCenter2' `
                     -ClassName AntiVirusProduct |
                   Select-Object -First 1

            $fwOff = @($fw | Where-Object { $_.Enabled -eq $false }).Count

            [pscustomobject]@{
                hostname            = $env:COMPUTERNAME
                os_version          = $os.Caption
                defender_enabled    = [bool]$mp.AntivirusEnabled
                realtime_protection = [bool]$mp.RealTimeProtectionEnabled
                antivirus_name      = $av.displayName
                firewall_enabled    = ($fwOff -eq 0)
                bitlocker_status    = if ($bl) { [string]$bl.ProtectionStatus } else { 'Unknown' }
                last_scan           = if ($mp.QuickScanEndTime) { $mp.QuickScanEndTime.ToString('o') } else { $null }
                uptime_days         = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalDays, 1)
            } | ConvertTo-Json -Compress
        "#;

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(
                String::from_utf8_lossy(&output.stderr).trim().to_string()
            );
        }

        let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();

        if raw.is_empty() {
            return Err("Security status unavailable".to_string());
        }

        serde_json::from_str::<serde_json::Value>(&raw)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn request_remote_session(
    device_id: String,
) -> Result<serde_json::Value, String> {
    use std::process::{Command, Stdio};

    tauri::async_runtime::spawn_blocking(move || {
        let key = std::fs::read_to_string(
            r"C:\nobody\admin-key.txt",
        )
        .map_err(|e| e.to_string())?;

        let body = serde_json::json!({
            "device_id": device_id
        })
        .to_string();

        let script = r#"
            $ErrorActionPreference = 'Stop'
            $body = [Console]::In.ReadToEnd()
            $response = Invoke-RestMethod `
                -Uri 'http://127.0.0.1:8765/remote/sessions' `
                -Method Post `
                -Headers @{ 'x-admin-key' = $env:NOBODY_ADMIN_KEY } `
                -ContentType 'application/json' `
                -Body $body
            $response | ConvertTo-Json -Compress
        "#;

        let mut command = Command::new("powershell");

command
    .args(["-NoProfile", "-NonInteractive", "-Command", script])
    .env("NOBODY_ADMIN_KEY", key.trim())
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

#[cfg(target_os = "windows")]
{
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x08000000);
}

let mut child = command
    .spawn()
    .map_err(|e| e.to_string())?;

        use std::io::Write;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(body.as_bytes())
                .map_err(|e| e.to_string())?;
        }

        let output = child
            .wait_with_output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(
                String::from_utf8_lossy(&output.stderr).to_string()
            );
        }

        serde_json::from_slice(&output.stdout)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn get_remote_screenshot(
    session_id: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let session_id = uuid::Uuid::parse_str(&session_id)
            .map_err(|e| e.to_string())?
            .to_string();

        let key = std::fs::read_to_string(
            r"C:\nobody\admin-key.txt",
        )
        .map_err(|e| e.to_string())?;

        let script = r#"
            $ErrorActionPreference = 'Stop'
            $response = Invoke-RestMethod `
                -Uri "http://127.0.0.1:8765/remote/sessions/$env:SESSION_ID/screenshot" `
                -Headers @{ 'x-admin-key' = $env:NOBODY_ADMIN_KEY }
            $response.image_base64
        "#;

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .env("NOBODY_ADMIN_KEY", key.trim())
            .env("SESSION_ID", session_id)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(
                String::from_utf8_lossy(&output.stderr).to_string()
            );
        }

        let image = String::from_utf8(output.stdout)
            .map_err(|e| e.to_string())?;

        Ok(format!("data:image/png;base64,{}", image.trim()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_remote_session(
    session_id: String,
) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let session_id = uuid::Uuid::parse_str(&session_id)
            .map_err(|e| e.to_string())?
            .to_string();

        let key = std::fs::read_to_string(
            r"C:\nobody\admin-key.txt",
        )
        .map_err(|e| e.to_string())?;

        let script = r#"
            $ErrorActionPreference = 'Stop'
            $response = Invoke-RestMethod `
                -Uri "http://127.0.0.1:8765/remote/sessions/$env:SESSION_ID" `
                -Method Get `
                -Headers @{ 'x-admin-key' = $env:NOBODY_ADMIN_KEY }
            $response | ConvertTo-Json -Compress
        "#;

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .env("NOBODY_ADMIN_KEY", key.trim())
            .env("SESSION_ID", session_id)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Err(
                String::from_utf8_lossy(&output.stderr).to_string()
            );
        }

        serde_json::from_slice(&output.stdout)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            init_database(&app.handle())
                .map_err(std::io::Error::other)?;

            write_activity_log(
                &app.handle(),
                "INFO",
                "NOBODY Control Center started",
            )
            .map_err(std::io::Error::other)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_info,
            get_system_monitor,
            get_network_adapters,
            get_ping_status,
            get_network_diagnostics,
            get_windows_security_status,
            dns_lookup,
            run_traceroute,
            get_active_connections,
            build_agent,
            close_remote_session,
            get_cloud_devices,
            delete_cloud_device,
            get_activity_logs,
            get_devices,
            add_device,
            remove_device,
            list_local_files,
            request_remote_session,
            get_remote_session, 
            get_remote_screenshot,
            run_local_diagnostic
        ])
        .run(tauri::generate_context!())
        .expect("error while running NOBODY application");
}
