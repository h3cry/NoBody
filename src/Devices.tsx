
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Monitor, Plus, Search, Wifi, Trash2, X, Laptop,
  ShieldCheck, Clock, Computer, RefreshCw, Cpu,
  MemoryStick, HardDrive, Activity, Server
} from "lucide-react";

type SystemInfo = {
  hostname: string;
  os_name: string;
  os_version: string;
  cpu_usage: number;
  memory_used_gb: number;
  memory_total_gb: number;
};

type Device = {
  id: number;
  name: string;
  hostname: string;
  os: string;
  status: "Online" | "Offline" | "Pending";
  type: string;
  added: string;
};

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [cloudDevices, setCloudDevices] = useState<
  { id: string; name: string; status: string }[]
>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [hostname, setHostname] = useState("");
  const [os, setOs] = useState("Windows 11");
  const [selected, setSelected] = useState<Device | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDevices = async () => {
    try {
      const result = await invoke<Device[]>("get_devices");
      setDevices(result);
      setError("");
    } catch (err) {
      setError(String(err));
    }
  };
const loadCloudDevices = async () => {
  try {
    const result = await invoke<
      { id: string; name: string; status: string }[]
    >("get_cloud_devices");

    setCloudDevices(result);
  } catch (err) {
    console.error("Cloud devices error:", err);
    
  }
};
const deleteCloudDevice = async (id: string, name: string) => {
  if (!window.confirm(`Delete cloud device "${name}"?`)) {
    return;
  }

  try {
    await invoke("delete_cloud_device", { id });
    await loadCloudDevices();
  } catch (err) {
    window.alert(`Delete failed: ${String(err)}`);
  }
};
  const loadSystemInfo = async () => {
    try {
      const result = await invoke<SystemInfo>("get_system_info");
      setSystemInfo(result);
    } catch (err) {
      console.error("System information error:", err);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
  loadDevices(),
  loadSystemInfo(),
  loadCloudDevices(),
]);
    setLoading(false);
  };
useEffect(() => {
  const interval = setInterval(() => {
    loadCloudDevices();
  }, 10000);

  return () => clearInterval(interval);
}, []);
  useEffect(() => {
    refreshAll();

    const interval = window.setInterval(() => {
      loadSystemInfo();
    }, 3000);

    return () => window.clearInterval(interval);
  }, []);

  const addDevice = async () => {
    if (!deviceName.trim() || !hostname.trim()) return;

    setLoading(true);
    setError("");

    try {
      await invoke<Device>("add_device", {
        name: deviceName.trim(),
        hostname: hostname.trim(),
        os,
      });

      setDeviceName("");
      setHostname("");
      setShowModal(false);
      await loadDevices();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const removeDevice = async (id: number) => {
    if (id === 1) return;

    if (!window.confirm("Are you sure you want to remove this device?")) {
      return;
    }

    try {
      await invoke("remove_device", { id });
      setSelected(null);
      await loadDevices();
    } catch (err) {
      setError(String(err));
    }
  };

  const filteredDevices = devices.filter((device) =>
    `${device.name} ${device.hostname} ${device.os}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const online = devices.filter((d) => d.status === "Online").length;
  const pending = devices.filter((d) => d.status === "Pending").length;
  const selectedIsLocal = selected?.id === 1;

  const cpu = Math.min(100, Math.max(0, systemInfo?.cpu_usage ?? 0));
  const ramUsed = systemInfo?.memory_used_gb ?? 0;
  const ramTotal = systemInfo?.memory_total_gb ?? 0;
  const ramPercent = ramTotal > 0
    ? Math.min(100, Math.max(0, (ramUsed / ramTotal) * 100))
    : 0;

  const formatAdded = (value: string) => {
    if (value === "Local device") return value;

    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return value;

    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="devices-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">DEVICE MANAGEMENT</div>
          <h1>Devices</h1>
          <p>Manage and monitor registered devices.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowModal(true)}
        >
          <Plus size={17} />
          Add Device
        </button>
      </div>

      <div className="device-stats">
        <div className="device-stat">
          <div className="device-stat-icon"><Monitor /></div>
          <div>
            <span>Total Devices</span>
            <strong>{devices.length}</strong>
          </div>
        </div>

        <div className="device-stat">
          <div className="device-stat-icon green"><Wifi /></div>
          <div>
            <span>Online</span>
            <strong>{online}</strong>
          </div>
        </div>

        <div className="device-stat">
          <div className="device-stat-icon orange"><Clock /></div>
          <div>
            <span>Pending Approval</span>
            <strong>{pending}</strong>
          </div>
        </div>
      </div>

      <div className="devices-panel">
        <div className="devices-toolbar">
          <div>
            <h2>Registered Devices</h2>
            <p>SQLite device inventory</p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="icon-button"
              onClick={refreshAll}
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw size={16} />
            </button>

            <div className="device-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search devices..."
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="modal-notice" style={{ marginBottom: 15 }}>
            {error}
          </div>
        )}

        <div className="device-table">
          <div className="device-table-head">
            <span>DEVICE</span>
            <span>OPERATING SYSTEM</span>
            <span>STATUS</span>
            <span>TYPE</span>
            <span>ACTION</span>
          </div>
{cloudDevices.map((device) => (
  <div className="device-row" key={`cloud-${device.id}`}>
    <div className="device-identity">
      <div className="device-avatar">
        <Laptop size={20} />
      </div>
      <div>
        <strong>{device.name}</strong>
        <small>{device.id}</small>
      </div>
    </div>

    <div className="device-os">Windows (Cloud)</div>

    <div>
      <span className="device-status pending">
        <span className="status-dot" />
        {device.status}
      </span>
    </div>

    <div className="device-type">Cloud Agent</div>

    <div className="device-actions">
      <button
        title="Cloud device details"
        onClick={() => window.alert(
          `Device: ${device.name}\nID: ${device.id}\nStatus: ${device.status}`
        )}
      >
        <Computer size={17} />
      </button>
      <button
  title="Delete cloud device"
  onClick={() => deleteCloudDevice(device.id, device.name)}
>
  <Trash2 size={17} />
</button>
    </div>
  </div>
))}
          {filteredDevices.map((device) => (
            <div className="device-row" key={device.id}>
              <div className="device-identity">
                <div className="device-avatar">
                  <Laptop size={20} />
                </div>
                <div>
                  <strong>{device.name}</strong>
                  <small>{device.hostname}</small>
                </div>
              </div>

              <div className="device-os">{device.os}</div>

              <div>
                <span className={`device-status ${device.status.toLowerCase()}`}>
                  <span className="status-dot" />
                  {device.status}
                </span>
              </div>

              <div className="device-type">{device.type}</div>

              <div className="device-actions">
                <button
                  title="View details"
                  onClick={() => setSelected(device)}
                >
                  <Computer size={17} />
                </button>

                <button
                  title="Remove device"
                  onClick={() => removeDevice(device.id)}
                  disabled={device.id === 1}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}

          {filteredDevices.length === 0 && (
            <div className="devices-empty">
              <Monitor size={30} />
              <strong>No devices found</strong>
              <span>Try another search or add a device.</span>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="device-modal-backdrop"
          onClick={() => setShowModal(false)}
        >
          <div
            className="device-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Add Device</h2>
                <p>Register a device in your local inventory.</p>
              </div>
              <button onClick={() => setShowModal(false)}>
                <X />
              </button>
            </div>

            <label>Device Name</label>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Office Computer"
            />

            <label>Hostname</label>
            <input
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="e.g. OFFICE-PC"
            />

            <label>Operating System</label>
            <select value={os} onChange={(e) => setOs(e.target.value)}>
              <option>Windows 11</option>
              <option>Windows 10</option>
              <option>Linux</option>
              <option>macOS</option>
            </select>

            <div className="modal-notice">
              <ShieldCheck size={18} />
              <span>
                This registers device information locally.
                It does not establish a remote connection.
              </span>
            </div>

            <button
              className="primary-button modal-submit"
              onClick={addDevice}
              disabled={loading || !deviceName.trim() || !hostname.trim()}
            >
              <Plus size={17} />
              {loading ? "Saving..." : "Register Device"}
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="device-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <div
            className="device-modal device-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <div className="page-eyebrow">DEVICE OVERVIEW</div>
                <h2>Device Details</h2>
                <p>Registered device information and telemetry.</p>
              </div>

              <button onClick={() => setSelected(null)}>
                <X />
              </button>
            </div>

            <div className="detail-device-banner">
              <div className="detail-device-avatar">
                {selectedIsLocal ? <Monitor size={27} /> : <Laptop size={27} />}
              </div>

              <div className="detail-device-title">
                <h3>{selected.name}</h3>
                <span>{selected.hostname}</span>
              </div>

              <span className={`device-status ${selected.status.toLowerCase()}`}>
                <span className="status-dot" />
                {selected.status}
              </span>
            </div>

            <div className="detail-section-heading">
              <Server size={16} />
              DEVICE INFORMATION
            </div>

            <div className="device-detail-list detail-information">
              <div>
                <span>Device ID</span>
                <strong>#{selected.id}</strong>
              </div>
              <div>
                <span>Hostname</span>
                <strong>{selected.hostname}</strong>
              </div>
              <div>
                <span>Operating System</span>
                <strong>{selected.os}</strong>
              </div>
              <div>
                <span>Device Type</span>
                <strong>{selected.type}</strong>
              </div>
              <div>
                <span>Registered</span>
                <strong>{formatAdded(selected.added)}</strong>
              </div>
            </div>

            {selectedIsLocal && systemInfo ? (
              <>
                <div className="detail-section-heading telemetry-heading">
                  <Activity size={16} />
                  LIVE SYSTEM TELEMETRY
                  <span className="telemetry-live">LIVE</span>
                </div>

                <div className="telemetry-grid">
                  <div className="telemetry-card">
                    <div className="telemetry-card-top">
                      <span><Cpu size={16} /> CPU USAGE</span>
                      <strong>{cpu.toFixed(1)}%</strong>
                    </div>
                    <div className="telemetry-track">
                      <div
                        className="telemetry-fill cpu-fill"
                        style={{ width: `${cpu}%` }}
                      />
                    </div>
                  </div>

                  <div className="telemetry-card">
                    <div className="telemetry-card-top">
                      <span><MemoryStick size={16} /> RAM USAGE</span>
                      <strong>{ramPercent.toFixed(1)}%</strong>
                    </div>
                    <div className="telemetry-track">
                      <div
                        className="telemetry-fill ram-fill"
                        style={{ width: `${ramPercent}%` }}
                      />
                    </div>
                    <small>
                      {ramUsed.toFixed(2)} GB used / {ramTotal.toFixed(2)} GB
                    </small>
                  </div>
                </div>

                <div className="telemetry-os-info">
                  <HardDrive size={16} />
                  <span>System</span>
                  <strong>{systemInfo.os_name} {systemInfo.os_version}</strong>
                </div>
              </>
            ) : (
              <div className="detail-not-connected">
                <ShieldCheck size={19} />
                <div>
                  <strong>Inventory record only</strong>
                  <span>
                    Live telemetry is unavailable because this device
                    has not established an authorized connection.
                  </span>
                </div>
              </div>
            )}

            <div className="detail-modal-footer">
              <span><ShieldCheck size={14} /> NOBODY DEVICE MANAGER</span>
              {selected.id !== 1 && (
                <button
                  className="detail-remove-button"
                  onClick={() => removeDevice(selected.id)}
                >
                  <Trash2 size={15} />
                  Remove Device
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
