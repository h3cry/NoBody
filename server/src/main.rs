use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    devices: Arc<Mutex<HashMap<String, Device>>>,
    sessions: Arc<Mutex<HashMap<String, RemoteSession>>>,
    screenshots: Arc<Mutex<HashMap<String, Vec<u8>>>>,
    admin_key: String,
}

#[derive(Clone, Serialize)]
struct RemoteSession {
    id: String,
    device_id: String,
    status: String,
    created_at: u64,
    last_frame: Option<u64>,
}

#[derive(Clone, Serialize)]
struct Device {
    id: String,
    name: String,
    status: String,
    last_seen: Option<u64>,
    #[serde(skip_serializing)]
    agent_token: String,
}

#[derive(Deserialize)]
struct EnrollmentRequest {
    device_name: String,
}

#[derive(Serialize)]
struct EnrollmentResponse {
    device_id: String,
    status: String,
    agent_token: String,
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "NOBODY Cloud API"
    }))
}

fn authorized(headers: &HeaderMap, key: &str) -> bool {
    headers
        .get("x-admin-key")
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v == key)
}

fn current_timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

async fn enroll(
    State(state): State<AppState>,
    Json(request): Json<EnrollmentRequest>,
) -> Result<Json<EnrollmentResponse>, StatusCode> {
    let name = request.device_name.trim();

    if name.is_empty() || name.len() > 100 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();

    state.devices.lock().await.insert(
        id.clone(),
        Device {
            id: id.clone(),
            name: name.to_string(),
            status: "Registered".to_string(),
            last_seen: None,
            agent_token: token.clone(),
        },
    );

    Ok(Json(EnrollmentResponse {
        device_id: id,
        status: "Registered".to_string(),
        agent_token: token,
    }))
}

async fn list_devices(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Device>>, StatusCode> {
    if !authorized(&headers, &state.admin_key) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let devices = state.devices.lock().await;
    let now = current_timestamp();

    let result: Vec<Device> = devices
        .values()
        .cloned()
        .map(|mut device| {
            device.status = match device.last_seen {
                Some(last_seen) if now.saturating_sub(last_seen) <= 30 => {
                    "Online".to_string()
                }
                _ => "Offline".to_string(),
            };
            device
        })
        .collect();

    Ok(Json(result))
}

async fn delete_device(
    State(state): State<AppState>,
    Path(device_id): Path<String>,
    headers: HeaderMap,
) -> Result<StatusCode, StatusCode> {
    if !authorized(&headers, &state.admin_key) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let mut devices = state.devices.lock().await;

    if devices.remove(&device_id).is_none() {
        return Err(StatusCode::NOT_FOUND);
    }
    drop(devices);

    let mut sessions = state.sessions.lock().await;
    sessions.retain(|_, session| session.device_id != device_id);
    drop(sessions);

    state.screenshots.lock().await.clear();

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct HeartbeatRequest {
    device_id: String,
    agent_token: String,
}

async fn heartbeat(
    State(state): State<AppState>,
    Json(request): Json<HeartbeatRequest>,
) -> Result<StatusCode, StatusCode> {
    let mut devices = state.devices.lock().await;

    let device = devices
        .get_mut(&request.device_id)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if device.agent_token != request.agent_token {
        return Err(StatusCode::UNAUTHORIZED);
    }

    device.last_seen = Some(current_timestamp());

    Ok(StatusCode::OK)
}

#[derive(Deserialize)]
struct SessionRequest {
    device_id: String,
}

async fn request_remote_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<SessionRequest>,
) -> Result<Json<RemoteSession>, StatusCode> {
    if !authorized(&headers, &state.admin_key) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let devices = state.devices.lock().await;

    let device = devices
        .get(&request.device_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let now = current_timestamp();

    if !device
        .last_seen
        .is_some_and(|last| now.saturating_sub(last) <= 30)
    {
        return Err(StatusCode::CONFLICT);
    }

    drop(devices);

    let session = RemoteSession {
        id: Uuid::new_v4().to_string(),
        device_id: request.device_id,
        status: "Approved".to_string(),
        created_at: now,
        last_frame: None,
    };

    state
        .sessions
        .lock()
        .await
        .insert(session.id.clone(), session.clone());

    Ok(Json(session))
}

#[derive(Deserialize)]
struct AgentAuth {
    device_id: String,
    agent_token: String,
}

async fn active_sessions(
    State(state): State<AppState>,
    Json(request): Json<AgentAuth>,
) -> Result<Json<Vec<RemoteSession>>, StatusCode> {
    let devices = state.devices.lock().await;

    let device = devices
        .get(&request.device_id)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if device.agent_token != request.agent_token {
        return Err(StatusCode::UNAUTHORIZED);
    }

    drop(devices);

    let sessions = state.sessions.lock().await;

    let active: Vec<RemoteSession> = sessions
        .values()
        .filter(|session| {
            session.device_id == request.device_id
                && session.status == "Approved"
        })
        .cloned()
        .collect();

    Ok(Json(active))
}

async fn close_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    headers: HeaderMap,
) -> Result<StatusCode, StatusCode> {
    if !authorized(&headers, &state.admin_key) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let mut sessions = state.sessions.lock().await;

    let session = sessions
        .get_mut(&session_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    session.status = "Closed".to_string();

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct ScreenshotUpload {
    device_id: String,
    agent_token: String,
    image_base64: String,
}

async fn upload_screenshot(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(request): Json<ScreenshotUpload>,
) -> Result<StatusCode, StatusCode> {
    use base64::Engine;

    let devices = state.devices.lock().await;
    let device = devices
        .get(&request.device_id)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if device.agent_token != request.agent_token {
        return Err(StatusCode::UNAUTHORIZED);
    }
    drop(devices);

    {
        let mut sessions = state.sessions.lock().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or(StatusCode::NOT_FOUND)?;

        if session.device_id != request.device_id
            || session.status != "Approved"
        {
            return Err(StatusCode::FORBIDDEN);
        }

        session.last_frame = Some(current_timestamp());
    }

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&request.image_base64)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    if bytes.len() > 10 * 1024 * 1024 {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Err(StatusCode::BAD_REQUEST);
    }

    state.screenshots.lock().await.insert(session_id, bytes);

    Ok(StatusCode::CREATED)
}

async fn get_screenshot(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, StatusCode> {
    use base64::Engine;

    if !authorized(&headers, &state.admin_key) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let sessions = state.sessions.lock().await;
    let session = sessions
        .get(&session_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    if session.status != "Approved" && session.status != "Closed" {
        return Err(StatusCode::FORBIDDEN);
    }
    drop(sessions);

    let screenshots = state.screenshots.lock().await;
    let bytes = screenshots
        .get(&session_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let image = base64::engine::general_purpose::STANDARD.encode(bytes);

    Ok(Json(serde_json::json!({
        "image_base64": image
    })))
}

async fn get_remote_session(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<RemoteSession>, StatusCode> {
    if !authorized(&headers, &state.admin_key) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let sessions = state.sessions.lock().await;

    let session = sessions
        .get(&session_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(session.clone()))
}

#[tokio::main]
async fn main() {
    let admin_key = std::env::var("NOBODY_ADMIN_KEY")
        .expect("Set NOBODY_ADMIN_KEY before starting the server");

    assert!(
        admin_key.len() >= 32,
        "NOBODY_ADMIN_KEY must contain at least 32 characters"
    );

    let state = AppState {
        devices: Arc::new(Mutex::new(HashMap::new())),
        sessions: Arc::new(Mutex::new(HashMap::new())),
        screenshots: Arc::new(Mutex::new(HashMap::new())),
        admin_key,
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/enroll", post(enroll))
        .route("/devices", get(list_devices))
        .route("/devices/{id}", delete(delete_device))
        .route("/heartbeat", post(heartbeat))
        .route("/remote/sessions", post(request_remote_session))
        .route("/remote/sessions/{id}", get(get_remote_session))
        .route("/remote/sessions/{id}/close", post(close_session))
        .route("/remote/active", post(active_sessions))
        .route(
            "/remote/sessions/{id}/screenshot",
            post(upload_screenshot).get(get_screenshot),
        )
        .with_state(state);

    let address = SocketAddr::from(([127, 0, 0, 1], 8765));

    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("Failed to start API server");

    println!("NOBODY API running at http://127.0.0.1:8765");

    axum::serve(listener, app)
        .await
        .expect("API server error");
}