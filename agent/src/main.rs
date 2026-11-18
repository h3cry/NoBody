use std::{
    collections::HashSet,
    io,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

const SERVER: &str = "http://127.0.0.1:8765";

type Creds = Arc<Mutex<(String, String)>>;
type Sessions = Arc<Mutex<HashSet<String>>>;

fn identity_path() -> std::path::PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);

    base.join("NOBODY").join("agent-identity.json")
}

fn load_identity() -> Option<(String, String)> {
    let content = std::fs::read_to_string(identity_path()).ok()?;
    let data: serde_json::Value = serde_json::from_str(&content).ok()?;

    Some((
        data["device_id"].as_str()?.to_string(),
        data["agent_token"].as_str()?.to_string(),
    ))
}

fn save_identity(device_id: &str, agent_token: &str) -> io::Result<()> {
    let path = identity_path();

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let data = serde_json::json!({
        "device_id": device_id,
        "agent_token": agent_token
    });

    std::fs::write(path, data.to_string())
}

fn device_name() -> String {
    std::env::var("COMPUTERNAME")
        .unwrap_or_else(|_| "Windows Device".to_string())
}

fn enroll(client: &reqwest::blocking::Client) -> Result<(String, String), String> {
    let response = client
        .post(format!("{SERVER}/enroll"))
        .json(&serde_json::json!({ "device_name": device_name() }))
        .send()
        .map_err(|e| format!("Connection error: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Enrollment failed: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .map_err(|e| format!("Invalid response: {e}"))?;

    let device_id = data["device_id"]
        .as_str()
        .ok_or("Missing device ID")?
        .to_string();

    let agent_token = data["agent_token"]
        .as_str()
        .ok_or("Missing agent token")?
        .to_string();

    save_identity(&device_id, &agent_token)
        .map_err(|e| format!("Identity save failed: {e}"))?;

    println!("Registered. Device ID: {device_id}");

    Ok((device_id, agent_token))
}

fn verify(
    client: &reqwest::blocking::Client,
    device_id: &str,
    agent_token: &str,
) -> Result<bool, ()> {
    let response = client
        .post(format!("{SERVER}/heartbeat"))
        .json(&serde_json::json!({
            "device_id": device_id,
            "agent_token": agent_token
        }))
        .send()
        .map_err(|_| ())?;

    Ok(response.status().is_success())
}

fn capture_screen_bytes() -> Result<Vec<u8>, String> {
    use screenshots::Screen;

    let screens = Screen::all().map_err(|e| e.to_string())?;

    let screen = screens.first().ok_or("No screen detected")?;

    let image = screen.capture().map_err(|e| e.to_string())?;

    let folder = std::env::temp_dir().join("NOBODY");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;

    let path = folder.join("frame.png");
    image.save(&path).map_err(|e| e.to_string())?;

    std::fs::read(&path).map_err(|e| e.to_string())
}

fn spawn_capture(
    client: reqwest::blocking::Client,
    creds: Creds,
    sessions: Sessions,
) {
    thread::spawn(move || loop {
        let ids: Vec<String> = {
            sessions.lock().unwrap().iter().cloned().collect()
        };

        if ids.is_empty() {
            thread::sleep(Duration::from_millis(500));
            continue;
        }

        match capture_screen_bytes() {
            Ok(bytes) => {
                use base64::Engine;

                let encoded =
                    base64::engine::general_purpose::STANDARD.encode(&bytes);

                let (device_id, token) = creds.lock().unwrap().clone();

                for session_id in ids {
                    let result = client
                        .post(format!(
                            "{SERVER}/remote/sessions/{session_id}/screenshot"
                        ))
                        .json(&serde_json::json!({
                            "device_id": device_id,
                            "agent_token": token,
                            "image_base64": encoded
                        }))
                        .send();

                    match result {
                        Ok(response) if response.status().is_success() => {}
                        Ok(response) => {
                            println!("Frame rejected: {}", response.status())
                        }
                        Err(error) => println!("Frame upload error: {error}"),
                    }
                }
            }
            Err(error) => println!("Capture error: {error}"),
        }

        thread::sleep(Duration::from_millis(1500));
    });
}

fn main() {
    println!("=== NOBODY Agent v0.5 ===");
    println!("Automatic enrollment. No prompts.");

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");

    let (device_id, agent_token) = match load_identity() {
        Some((id, token)) => {
            let mut valid = false;

            for _ in 0..10 {
                match verify(&client, &id, &token) {
                    Ok(result) => {
                        valid = result;
                        break;
                    }
                    Err(_) => thread::sleep(Duration::from_secs(2)),
                }
            }

            if valid {
                println!("Identity verified. Device ID: {id}");
                (id, token)
            } else {
                match enroll(&client) {
                    Ok(pair) => pair,
                    Err(error) => {
                        println!("{error}");
                        return;
                    }
                }
            }
        }
        None => match enroll(&client) {
            Ok(pair) => pair,
            Err(error) => {
                println!("{error}");
                return;
            }
        },
    };

    let creds: Creds = Arc::new(Mutex::new((device_id, agent_token)));
    let sessions: Sessions = Arc::new(Mutex::new(HashSet::new()));

    spawn_capture(client.clone(), Arc::clone(&creds), Arc::clone(&sessions));

    println!("Heartbeat active.");

    loop {
        let (id, token) = creds.lock().unwrap().clone();

        match client
            .post(format!("{SERVER}/heartbeat"))
            .json(&serde_json::json!({
                "device_id": id,
                "agent_token": token
            }))
            .send()
        {
            Ok(response) if response.status().is_success() => {}
            Ok(response) if response.status().as_u16() == 401 => {
                println!("Registration lost. Re-enrolling...");

                match enroll(&client) {
                    Ok(pair) => *creds.lock().unwrap() = pair,
                    Err(error) => println!("{error}"),
                }

                continue;
            }
            Ok(response) => println!("Heartbeat: {}", response.status()),
            Err(error) => println!("Connection error: {error}"),
        }

        match client
            .post(format!("{SERVER}/remote/active"))
            .json(&serde_json::json!({
                "device_id": id,
                "agent_token": token
            }))
            .send()
        {
            Ok(response) if response.status().is_success() => {
                if let Ok(list) = response.json::<Vec<serde_json::Value>>() {
                    let mut set = sessions.lock().unwrap();
                    set.clear();

                    for session in list {
                        if let Some(session_id) = session["id"].as_str() {
                            set.insert(session_id.to_string());
                        }
                    }
                }
            }
            _ => {}
        }

        thread::sleep(Duration::from_secs(3));
    }
}