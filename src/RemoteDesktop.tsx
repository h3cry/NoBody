import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Monitor,
  ShieldCheck,
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
  Laptop,
  Radio,
} from "lucide-react";

type SessionStatus = "Approved" | "Closed" | "Disconnected";

type CloudDevice = {
  id: string;
  name: string;
  status: string;
};

type RemoteSession = {
  id: string;
  device_id: string;
  status: SessionStatus;
  created_at: number;
};

const STATUS_COLOR: Record<SessionStatus, string> = {
  Approved: "#22c55e",
  Closed: "#94a3b8",
  Disconnected: "#94a3b8",
};

const toDataUrl = (raw: string) =>
  raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;

export default function RemoteDesktop() {
  const [devices, setDevices] = useState<CloudDevice[]>([]);
  const [deviceError, setDeviceError] = useState("");
  const [loadingDevices, setLoadingDevices] = useState(false);

  const [targetId, setTargetId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [status, setStatus] = useState<SessionStatus>("Disconnected");
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [shotAt, setShotAt] = useState<number | null>(null);
  const [capturing, setCapturing] = useState(false);

  const busy = useRef(false);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);

    try {
      const result = await invoke<CloudDevice[]>("get_cloud_devices");
      setDevices(result);
      setDeviceError("");
    } catch (err) {
      setDeviceError(String(err));
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const timer = setInterval(loadDevices, 5000);
    return () => clearInterval(timer);
  }, [loadDevices]);

  const loadScreenshot = useCallback(async () => {
    if (!sessionId || status !== "Approved" || busy.current) return;

    busy.current = true;
    setCapturing(true);

    try {
      const image = await invoke<string>("get_remote_screenshot", {
        sessionId,
      });
      setScreenshot(toDataUrl(image));
      setShotAt(Date.now());
      setError("");
    } catch (err) {
      setError(`Screenshot: ${String(err)}`);
    } finally {
      busy.current = false;
      setCapturing(false);
    }
  }, [sessionId, status]);

  useEffect(() => {
    if (status !== "Approved") return;

    loadScreenshot();
    const timer = setInterval(loadScreenshot, 1500);
    return () => clearInterval(timer);
  }, [status, loadScreenshot]);

  const connectTo = async (device: CloudDevice) => {
    if (device.status !== "Online") {
      setError(`${device.name} is offline.`);
      return;
    }

    setLoading(true);
    setError("");
    setScreenshot("");
    setShotAt(null);
    setTargetId(device.id);
    setTargetName(device.name);

    try {
      const session = await invoke<RemoteSession>(
        "request_remote_session",
        { deviceId: device.id }
      );
      setSessionId(session.id);
      setStatus(session.status);
    } catch (err) {
      setStatus("Disconnected");
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const resetSession = async () => {
    if (sessionId) {
      try {
        await invoke("close_remote_session", { sessionId });
      } catch {
        /* ignore */
      }
    }

    setSessionId("");
    setStatus("Disconnected");
    setError("");
    setScreenshot("");
    setShotAt(null);
    setTargetId("");
    setTargetName("");
  };

  const online = devices.filter((d) => d.status === "Online").length;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">REMOTE MANAGEMENT</div>
          <h1>Remote Desktop</h1>
          <p>Pick an online agent — the session opens instantly.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>SESSION STATUS</span>
            <Wifi />
          </div>
          <strong style={{ color: STATUS_COLOR[status] }}>{status}</strong>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>AGENTS ONLINE</span>
            <Radio />
          </div>
          <strong>{online}</strong>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>SECURITY</span>
            <ShieldCheck />
          </div>
          <strong>Auto-connect</strong>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <div>
            <h2>Available Agents</h2>
            <p>Auto-refreshed every 5 seconds.</p>
          </div>

          <button
            className="icon-button"
            onClick={loadDevices}
            disabled={loadingDevices}
            title="Refresh agents"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div style={{ padding: 12 }}>
          {deviceError && (
            <p style={{ color: "#ef4444", padding: "0 8px" }}>
              {deviceError}
            </p>
          )}

          {!deviceError && devices.length === 0 && (
            <p style={{ color: "#94a3b8", padding: "0 8px" }}>
              No agents registered yet.
            </p>
          )}

          {devices.map((device) => {
            const isOnline = device.status === "Online";
            const isActive = targetId === device.id;

            return (
              <div
                key={device.id}
                onClick={() => !loading && connectTo(device)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 14,
                  marginBottom: 8,
                  borderRadius: 10,
                  border: `1px solid ${
                    isActive ? "#22c55e" : "#303644"
                  }`,
                  background: isActive ? "rgba(34,197,94,0.08)" : "#10131a",
                  cursor: isOnline && !loading ? "pointer" : "not-allowed",
                  opacity: isOnline ? 1 : 0.55,
                }}
              >
                <Laptop size={20} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: "block" }}>{device.name}</strong>
                  <small style={{ color: "#64748b" }}>{device.id}</small>
                </div>

                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: isOnline ? "#22c55e" : "#94a3b8",
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: isOnline ? "#22c55e" : "#64748b",
                    }}
                  />
                  {device.status}
                </span>

                <button
                  className="primary-button"
                  disabled={!isOnline || loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    connectTo(device);
                  }}
                >
                  <Wifi size={15} />
                  Connect
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {(targetName || sessionId) && (
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div>
              <h2>{targetName || "Session"}</h2>
              <p>{sessionId ? `Session: ${sessionId}` : "Connecting…"}</p>
            </div>

            <button
              className="icon-button"
              onClick={resetSession}
              title="Close session"
            >
              <Power size={17} />
            </button>
          </div>

          {error && (
            <p style={{ color: "#ef4444", padding: "0 20px" }}>{error}</p>
          )}
        </div>
      )}

      {!targetName && error && (
        <div className="panel" style={{ marginTop: 20 }}>
          <p style={{ color: "#ef4444", padding: 20 }}>{error}</p>
        </div>
      )}

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <div>
            <h2>Remote Screen</h2>
            <p>Continuous live capture, refreshed every 1.5 seconds.</p>
          </div>
          <WifiOff />
        </div>

        <div
          style={{
            minHeight: 260,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 12,
            color: "#94a3b8",
          }}
        >
          {screenshot ? (
            <img
              src={screenshot}
              alt="Remote screen"
              style={{
                width: "100%",
                maxHeight: 500,
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          ) : (
            <>
              <Monitor size={54} />
              <strong>No screenshot loaded</strong>
              <span>
                {status === "Approved"
                  ? "First frame is loading…"
                  : "Click an online agent to start the stream."}
              </span>
            </>
          )}

          <button
            className="primary-button"
            disabled={status !== "Approved" || capturing}
            onClick={loadScreenshot}
          >
            <RefreshCw size={16} />
            {capturing ? "Capturing..." : "Capture Now"}
          </button>

          {shotAt && (
            <span style={{ fontSize: 12 }}>
              last frame: {new Date(shotAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}