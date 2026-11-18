
import FileManager from "./FileManager";
import TerminalPage from "./Terminal";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  LayoutDashboard,
  Monitor,
  Activity,
  ShieldCheck,
  Network,
  Settings,
  Search,
  Bell,
  Cpu,
  HardDrive,
  MemoryStick,
  Clock,
  CircleCheck,
  CircleAlert,
  Terminal,
  Folder,
  Zap,
  Menu,
  Laptop,
  RefreshCw,
} from "lucide-react";

import Devices from "./Devices";
import PerformanceChart from "./PerformanceChart";
import "./App.css";
import SecurityCenter from "./SecurityCenter";
import RemoteDesktop from "./RemoteDesktop";
import AgentBuilder from "./AgentBuilder";

type SystemInfo = {
  hostname: string;
  os_name: string;
  os_version: string;
  cpu_usage: number;
  memory_used_gb: number;
  memory_total_gb: number;
};

type DiskInfo = {
  name: string;
  total_gb: number;
  available_gb: number;
  used_percent: number;
};

type ProcessInfo = {
  pid: string;
  name: string;
  cpu_usage: number;
  memory_mb: number;
};

type NetworkInfo = {
  download_mbps: number;
  upload_mbps: number;
  total_received_mb: number;
  total_transmitted_mb: number;
};
type NetworkAdapter = {
  name: string;
  ip_address: string;
  address_type: string;
  mac_address: string;
  connected: boolean;
};
type SystemMonitor = {
  cpu_usage: number;
  cpu_cores: number;
  memory_used_gb: number;
  memory_total_gb: number;
  memory_percent: number;
  disks: DiskInfo[];
  network: NetworkInfo;
  processes: ProcessInfo[];
};

type PerformanceHistory = {
  cpu: number[];
  ram: number[];
  download: number[];
  upload: number[];
};

const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Devices", icon: Monitor },
  { name: "Agent Builder", icon: Cpu },
  { name: "Remote Desktop", icon: Monitor },
  { name: "System Monitor", icon: Activity },
  { name: "File Manager", icon: Folder },
  { name: "Network", icon: Network },
  { name: "Terminal", icon: Terminal },
  { name: "Security Center", icon: ShieldCheck },
  { name: "Activity Logs", icon: Clock },
  { name: "Settings", icon: Settings },
];

function DashboardPage({ info }: { info: SystemInfo | null }) {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">OVERVIEW</div>
          <h1>Dashboard</h1>
          <p>Welcome to your NOBODY control center.</p>
        </div>
        <div className="live-indicator">
          <span className="live-dot" /> SYSTEM ONLINE
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top"><span>CPU USAGE</span><Cpu /></div>
          <strong>{info ? `${info.cpu_usage.toFixed(1)}%` : "--"}</strong>
          <small>Local processor</small>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span>MEMORY</span><MemoryStick /></div>
          <strong>{info ? `${info.memory_used_gb.toFixed(1)} GB` : "--"}</strong>
          <small>{info ? `of ${info.memory_total_gb.toFixed(1)} GB` : "System RAM"}</small>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span>DEVICES</span><Monitor /></div>
          <strong>1</strong>
          <small>Local workstation</small>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span>SECURITY</span><ShieldCheck /></div>
          <strong>Active</strong>
          <small>Local application status</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div><h2>System Information</h2><p>Current workstation</p></div>
            <Laptop />
          </div>

          <div className="info-list">
            <div><span>Hostname</span><strong>{info?.hostname ?? "Loading..."}</strong></div>
            <div>
              <span>Operating System</span>
              <strong>{info ? `${info.os_name} ${info.os_version}` : "Loading..."}</strong>
            </div>
            <div><span>Connection</span><strong className="success-text">Local</strong></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div><h2>System Status</h2><p>Application health</p></div>
            <Zap />
          </div>

          <div className="status-item">
            <CircleCheck className="success-text" />
            <div><strong>Application running</strong><small>NOBODY desktop client</small></div>
          </div>

          <div className="status-item">
            <CircleCheck className="success-text" />
            <div><strong>Local system core</strong><small>System information available</small></div>
          </div>

          <div className="status-item">
            <CircleAlert className="warning-text" />
            <div><strong>Remote connections</strong><small>Not configured</small></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemMonitorPage({
  monitor,
  error,
  history,
}: {
  monitor: SystemMonitor | null;
  error: string | null;
  history: PerformanceHistory;
}) {
  const cpu = Math.min(monitor?.cpu_usage ?? 0, 100);
  const ram = Math.min(monitor?.memory_percent ?? 0, 100);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">PERFORMANCE</div>
          <h1>System Monitor</h1>
          <p>Live local workstation resource monitoring.</p>
        </div>
        <div className="live-indicator">
          <span className="live-dot" /> LIVE
        </div>
      </div>

      {error && (
        <div className="panel">
          <p className="warning-text">Monitor error: {error}</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top"><span>CPU LOAD</span><Cpu /></div>
          <strong>{monitor ? `${cpu.toFixed(1)}%` : "--"}</strong>
          <small>{monitor ? `${monitor.cpu_cores} logical cores` : "Loading..."}</small>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span>RAM USED</span><MemoryStick /></div>
          <strong>{monitor ? `${monitor.memory_used_gb.toFixed(2)} GB` : "--"}</strong>
          <small>{monitor ? `Total ${monitor.memory_total_gb.toFixed(2)} GB` : "Loading..."}</small>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span>RAM FREE</span><HardDrive /></div>
          <strong>
            {monitor
              ? `${Math.max(0, monitor.memory_total_gb - monitor.memory_used_gb).toFixed(2)} GB`
              : "--"}
          </strong>
          <small>Available memory</small>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span>PROCESSES</span><Activity /></div>
          <strong>{monitor ? monitor.processes.length : "--"}</strong>
          <small>Top CPU processes shown</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel monitor-panel">
          <div className="panel-heading">
            <div><h2>CPU Performance</h2><p>Global processor usage</p></div>
            <Cpu />
          </div>

          <div className="monitor-metric">
            <div><span>CPU Usage</span><strong>{monitor ? `${cpu.toFixed(1)}%` : "--"}</strong></div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${cpu}%` }} />
            </div>
          </div>
        </div>

        <div className="panel monitor-panel">
          <div className="panel-heading">
            <div><h2>Memory Performance</h2><p>Physical RAM usage</p></div>
            <MemoryStick />
          </div>

          <div className="monitor-metric">
            <div><span>Memory Usage</span><strong>{monitor ? `${ram.toFixed(1)}%` : "--"}</strong></div>
            <div className="progress-track">
              <div className="progress-fill memory-fill" style={{ width: `${ram}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* LIVE PERFORMANCE HISTORY */}
      <div className="performance-charts-grid">
        <PerformanceChart
          title="CPU History"
          subtitle="Processor utilization"
          data={history.cpu}
          color="#e34b61"
        />

        <PerformanceChart
          title="RAM History"
          subtitle="Physical memory utilization"
          data={history.ram}
          color="#b47be8"
        />

        <PerformanceChart
          title="Download History"
          subtitle="Incoming network traffic"
          data={history.download}
          color="#38a6e8"
          suffix=" Mbps"
        />

        <PerformanceChart
          title="Upload History"
          subtitle="Outgoing network traffic"
          data={history.upload}
          color="#26c99a"
          suffix=" Mbps"
        />
      </div>

      {/* DISK STORAGE */}
      <div className="panel monitor-panel">
        <div className="panel-heading">
          <div><h2>Disk Storage</h2><p>Detected local disk volumes</p></div>
          <HardDrive />
        </div>

        {!monitor ? (
          <p>Loading disk information...</p>
        ) : monitor.disks.length === 0 ? (
          <p>No disk information available.</p>
        ) : (
          <div className="system-monitor-list">
            {monitor.disks.map((disk, index) => (
              <div className="monitor-metric" key={`${disk.name}-${index}`}>
                <div>
                  <span>{disk.name}</span>
                  <strong>{disk.used_percent.toFixed(1)}%</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill disk-fill"
                    style={{ width: `${Math.min(disk.used_percent, 100)}%` }}
                  />
                </div>
 
                <small>
                  {(disk.total_gb - disk.available_gb).toFixed(2)} GB used
                  {" / "}{disk.total_gb.toFixed(2)} GB total
                  {" · "}{disk.available_gb.toFixed(2)} GB free
                </small>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NETWORK ACTIVITY */}
      <div className="panel monitor-panel">
        <div className="panel-heading">
          <div><h2>Network Activity</h2><p>Local network traffic</p></div>
          <Network />
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top"><span>DOWNLOAD</span><Network /></div>
            <strong>{monitor ? monitor.network.download_mbps.toFixed(2) : "--"}</strong>
            <small>Mbps</small>
          </div>

          <div className="stat-card">
            <div className="stat-top"><span>UPLOAD</span><Network /></div>
            <strong>{monitor ? monitor.network.upload_mbps.toFixed(2) : "--"}</strong>
            <small>Mbps</small>
          </div>

          <div className="stat-card">
            <div className="stat-top"><span>RECEIVED</span><Activity /></div>
            <strong>{monitor ? `${monitor.network.total_received_mb.toFixed(1)} MB` : "--"}</strong>
            <small>Total received</small>
          </div>

          <div className="stat-card">
            <div className="stat-top"><span>SENT</span><Activity /></div>
            <strong>{monitor ? `${monitor.network.total_transmitted_mb.toFixed(1)} MB` : "--"}</strong>
            <small>Total transmitted</small>
          </div>
        </div>
      </div>

      {/* PROCESSES */}
      <div className="panel monitor-panel">
        <div className="panel-heading">
          <div><h2>Top Processes</h2><p>Processes ranked by CPU usage</p></div>
          <Activity />
        </div>

        <div className="process-table-wrap">
          <table className="process-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>PROCESS</th>
                <th>CPU</th>
                <th>MEMORY</th>
              </tr>
            </thead>

            <tbody>
              {!monitor ? (
                <tr><td colSpan={4}>Loading processes...</td></tr>
              ) : monitor.processes.length === 0 ? (
                <tr><td colSpan={4}>No processes available.</td></tr>
              ) : (
                monitor.processes.map((process) => (
                  <tr key={process.pid}>
                    <td>{process.pid}</td>
                    <td>{process.name || "Unknown"}</td>
                    <td>{process.cpu_usage.toFixed(1)}%</td>
                    <td>{process.memory_mb.toFixed(1)} MB</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}




function NetworkPage({
  monitor,
  error,
  history,
  adapters,
  adapterError,
}: {
  monitor: SystemMonitor | null;
  error: string | null;
  history: PerformanceHistory;
  adapters: NetworkAdapter[];
  adapterError: string | null;
}) {
  type PingInfo = {
    host: string;
    reachable: boolean;
    latency_ms: number | null;
  };

  type PingSample = {
    time: string;
    latency: number | null;
    reachable: boolean;
  };

  const network = monitor?.network;
type DiagnosticsInfo = {
  gateway: string;
  dns_servers: string[];
  internet_available: boolean;
};

type ActiveConnection = {
  protocol: string;
  local_address: string;
  remote_address: string;
  state: string;
  pid: number;
  process_name: string;
};

const [activeConnections, setActiveConnections] =
  useState<ActiveConnection[]>([]);
const [connectionsLoading, setConnectionsLoading] = useState(false);
const [connectionSearch, setConnectionSearch] = useState("");
const [protocolFilter, setProtocolFilter] = useState("ALL");
const [stateFilter, setStateFilter] = useState("ALL");
const [connectionSort, setConnectionSort] = useState("process");
const [selectedConnection, setSelectedConnection] =
  useState<ActiveConnection | null>(null);
  

const loadActiveConnections = async () => {
  setConnectionsLoading(true);

  try {
    const result = await invoke<ActiveConnection[]>(
      "get_active_connections"
    );
    setActiveConnections(result);
  } catch (error) {
    console.error("Connection loading error:", error);
  } finally {
    setConnectionsLoading(false);
  }
};
const filteredConnections = activeConnections
  .filter((connection) => {
    const search = connectionSearch.toLowerCase();

    const matchesSearch =
      connection.process_name.toLowerCase().includes(search) ||
      connection.local_address.toLowerCase().includes(search) ||
      connection.remote_address.toLowerCase().includes(search) ||
      connection.pid.toString().includes(search);

    const matchesProtocol =
      protocolFilter === "ALL" ||
      connection.protocol === protocolFilter;

    const matchesState =
      stateFilter === "ALL" ||
      connection.state === stateFilter;

    return matchesSearch && matchesProtocol && matchesState;
  })
  .sort((a, b) => {
    if (connectionSort === "pid") {
      return a.pid - b.pid;
    }

    if (connectionSort === "state") {
      return a.state.localeCompare(b.state);
    }

    return a.process_name.localeCompare(b.process_name);
  });

useEffect(() => {
  loadActiveConnections();

  const interval = window.setInterval(
    loadActiveConnections,
    5000
  );

  return () => window.clearInterval(interval);
}, []);


const [diagnostics, setDiagnostics] =
  useState<DiagnosticsInfo | null>(null);

const [dnsHost, setDnsHost] = useState("google.com");
const [dnsResults, setDnsResults] = useState<string[]>([]);
const [dnsLoading, setDnsLoading] = useState(false);

const [traceHost, setTraceHost] = useState("google.com");
const [traceResults, setTraceResults] = useState<string[]>([]);
const [traceLoading, setTraceLoading] = useState(false);

const runTrace = async () => {
  const host = traceHost.trim();
  if (!host) return;

  setTraceLoading(true);
  setTraceResults([]);

  try {
    const result = await invoke<string[]>("run_traceroute", {
      host,
    });
    setTraceResults(result);
  } catch (error) {
    setTraceResults([`Traceroute failed: ${String(error)}`]);
  } finally {
    setTraceLoading(false);
  }
};


const loadDiagnostics = async () => {
  try {
    const result = await invoke<DiagnosticsInfo>(
      "get_network_diagnostics"
    );
    setDiagnostics(result);
  } catch (error) {
    console.error("Diagnostics error:", error);
  }
};

const runDnsLookup = async () => {
  const host = dnsHost.trim();

  if (!host) return;

  setDnsLoading(true);
  setDnsResults([]);

  try {
    const result = await invoke<string[]>("dns_lookup", {
      host,
    });

    setDnsResults(result);

    if (result.length === 0) {
      console.warn("DNS lookup returned no addresses.");
    }
  } catch (error) {
    console.error("DNS lookup error:", error);
    setDnsResults([]);
  } finally {
    setDnsLoading(false);
  }
};

useEffect(() => {
  loadDiagnostics();
  const interval = window.setInterval(loadDiagnostics, 15000);
  return () => window.clearInterval(interval);
}, []);

  const [publicIp, setPublicIp] = useState("--");
  const [internetStatus, setInternetStatus] = useState<
    "Checking" | "Connected" | "Disconnected"
  >("Checking");
  const [lastChecked, setLastChecked] = useState("--");
  const [checking, setChecking] = useState(false);

  // PING MONITOR STATE
  const [pingSamples, setPingSamples] = useState<PingSample[]>([]);
  const [pingChecking, setPingChecking] = useState(false);
  const [targetHost, setTargetHost] = useState("1.1.1.1");
  const [isPingRunning, setIsPingRunning] = useState(true);

  const checkInternet = async () => {
    setChecking(true);

    try {
      const response = await fetch(
        "https://api.ipify.org?format=json",
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error("Internet check failed");
      }

      const data: { ip: string } = await response.json();

      setPublicIp(data.ip);
      setInternetStatus("Connected");
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      setInternetStatus("Disconnected");
      setPublicIp("--");
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setChecking(false);
    }
  };

  const checkPing = async () => {
    if (pingChecking) return;

    setPingChecking(true);

    try {
      const result = await invoke<PingInfo>("get_ping_status", {
  host: targetHost,
});

      const sample: PingSample = {
        time: new Date().toLocaleTimeString(),
        latency: result.latency_ms,
        reachable: result.reachable,
      };

      setPingSamples((previous) => [
        ...previous,
        sample,
      ].slice(-30));
    } catch {
      const sample: PingSample = {
        time: new Date().toLocaleTimeString(),
        latency: null,
        reachable: false,
      };

      setPingSamples((previous) => [
        ...previous,
        sample,
      ].slice(-30));
    } finally {
      setPingChecking(false);
    }
  };

  useEffect(() => {
    checkInternet();

    const interval = window.setInterval(checkInternet, 30000);

    return () => window.clearInterval(interval);
  }, []);

  // PING AUTOMATIC REFRESH
  useEffect(() => {
  if (!isPingRunning) return;

  checkPing();

  const interval = window.setInterval(() => {
    checkPing();
  }, 2000);

  return () => window.clearInterval(interval);
}, [isPingRunning, targetHost]);

  const statusColor =
    internetStatus === "Connected"
      ? "success-text"
      : internetStatus === "Disconnected"
      ? "warning-text"
      : "";

  // PING STATISTICS
  const lastPing = pingSamples[pingSamples.length - 1];

  const validPings = pingSamples
    .filter((sample) => sample.reachable && sample.latency !== null)
    .map((sample) => sample.latency as number);

  const averagePing =
    validPings.length > 0
      ? validPings.reduce((sum, value) => sum + value, 0) /
        validPings.length
      : null;

  const pingDifferences = validPings
    .slice(1)
    .map((value, index) => Math.abs(value - validPings[index]));

  const jitter =
    pingDifferences.length > 0
      ? pingDifferences.reduce((sum, value) => sum + value, 0) /
        pingDifferences.length
      : null;

  const lostPackets = pingSamples.filter(
    (sample) => !sample.reachable
  ).length;

  const packetLoss =
    pingSamples.length > 0
      ? (lostPackets / pingSamples.length) * 100
      : 0;

  // PING GRAPH
  const graphValues = pingSamples.map((sample) =>
    sample.reachable && sample.latency !== null
      ? sample.latency
      : 0
  );

  const graphMax = Math.max(100, ...graphValues) * 1.2;

  const graphPoints = graphValues
    .map((value, index) => {
      const x =
        graphValues.length > 1
          ? (index / (graphValues.length - 1)) * 580 + 10
          : 300;

      const y = 130 - (value / graphMax) * 110;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">NETWORK MANAGEMENT</div>
          <h1>Network</h1>
          <p>Live local workstation network monitoring.</p>
        </div>

        <div className="live-indicator">
          <span className="live-dot" /> LIVE
        </div>
      </div>

      {error && (
        <div className="panel">
          <p className="warning-text">Network error: {error}</p>
        </div>
      )}

      {/* INTERNET CONNECTION */}
      <div className="panel monitor-panel">
        <div className="panel-heading">
          <div>
            <h2>Internet Connection</h2>
            <p>External connectivity and public IP information</p>
          </div>
          <Network />
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span>CONNECTION STATUS</span>
              <Activity />
            </div>
            <strong className={statusColor}>{internetStatus}</strong>
            <small>External connectivity check</small>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>PUBLIC IP ADDRESS</span>
              <Network />
            </div>
            <strong style={{ fontSize: 19 }}>{publicIp}</strong>
            <small>External IP address</small>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>LAST CHECKED</span>
              <Clock />
            </div>
            <strong style={{ fontSize: 19 }}>{lastChecked}</strong>
            <small>Automatic check every 30 seconds</small>
          </div>
        </div>

        <button
          className="primary-button"
          onClick={checkInternet}
          disabled={checking}
          style={{ marginTop: 16 }}
        >
          <Activity size={16} />
          {checking ? "Checking..." : "Check Connection"}
        </button>
      </div>

      {/* PING MONITOR */}
      <div className="panel monitor-panel">
        <div className="panel-heading">
          <div>
            <h2>Ping Monitor</h2>
            <p>Live latency, jitter and packet loss · 1.1.1.1</p>
          </div>
          <Activity />
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span>LIVE PING</span>
              <Activity />
            </div>
            <strong className={
              lastPing?.reachable ? "success-text" : "warning-text"
            }>
              {lastPing?.reachable && lastPing.latency !== null
                ? `${lastPing.latency} ms`
                : lastPing
                ? "Timeout"
                : "--"}
            </strong>
            <small>Current response time</small>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>AVERAGE PING</span>
              <Clock />
            </div>
            <strong>
              {averagePing !== null
                ? `${averagePing.toFixed(1)} ms`
                : "--"}
            </strong>
            <small>Last 30 measurements</small>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>JITTER</span>
              <Activity />
            </div>
            <strong>
              {jitter !== null ? `${jitter.toFixed(1)} ms` : "--"}
            </strong>
            <small>Average ping variation</small>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>PACKET LOSS</span>
              <Network />
            </div>
            <strong className={
              packetLoss > 0 ? "warning-text" : "success-text"
            }>
              {packetLoss.toFixed(1)}%
            </strong>
            <small>{lostPackets} lost / {pingSamples.length} samples</small>
          </div>
        </div>

{/* PING CONTROLS */}
<div style={{
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: 20,
  marginBottom: 20
}}>
  <input
    value={targetHost}
    onChange={(e) => setTargetHost(e.target.value)}
    placeholder="IP address or hostname"
    style={{
      flex: 1,
      minWidth: 180,
      padding: 13,
      borderRadius: 8,
      border: "1px solid #29313d",
      background: "#0d1119",
      color: "#fff",
      outline: "none"
    }}
  />

  <button
    className="primary-button"
    onClick={() => setIsPingRunning(!isPingRunning)}
  >
    {isPingRunning ? "Stop Ping" : "Start Ping"}
  </button>

  <button
    className="primary-button"
    onClick={() => setPingSamples([])}
    style={{ background: "#343b49" }}
  >
    Clear History
  </button>
</div>

        {/* PING GRAPH */}
        <div style={{ marginTop: 25 }}>
          <div className="panel-heading">
            <div>
              <h2>Real-Time Ping History</h2>
              <p>Last 30 measurements · Refresh every 2 seconds</p>
            </div>
            <strong style={{ color: "#38a6e8" }}>
              {pingSamples.length}/30
            </strong>
          </div>

          <div style={{
            width: "100%",
            height: 170,
            marginTop: 12,
            background: "#0d1119",
            borderRadius: 10,
            padding: 12,
            boxSizing: "border-box"
          }}>
            <svg
              viewBox="0 0 600 145"
              width="100%"
              height="100%"
              preserveAspectRatio="none"
            >
              {[25, 60, 95, 130].map((y) => (
                <line
                  key={y}
                  x1="10"
                  y1={y}
                  x2="590"
                  y2={y}
                  stroke="#29313d"
                  strokeDasharray="5 5"
                />
              ))}

              {graphValues.length > 0 && (
                <polyline
                  points={graphPoints}
                  fill="none"
                  stroke="#38a6e8"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>
        </div>

        {/* CONNECTION ALERT */}
        <div style={{
          marginTop: 18,
          padding: 15,
          borderRadius: 9,
          background: lastPing && !lastPing.reachable
            ? "rgba(255, 75, 90, 0.10)"
            : "rgba(38, 201, 154, 0.08)",
          border: `1px solid ${
            lastPing && !lastPing.reachable
              ? "rgba(255, 75, 90, 0.35)"
              : "rgba(38, 201, 154, 0.25)"
          }`
        }}>
          <strong className={
            lastPing && !lastPing.reachable
              ? "warning-text"
              : "success-text"
          }>
            {lastPing && !lastPing.reachable
              ? "Connection Alert: Host is unreachable!"
              : "Connection Stable"}
          </strong>
          <p style={{ margin: "6px 0 0", color: "#8e9aaf", fontSize: 13 }}>
            {lastPing && !lastPing.reachable
              ? "The latest ping request timed out."
              : "No packet loss detected in the latest measurements."}
          </p>
        </div>

        <button
          className="primary-button"
          onClick={checkPing}
          disabled={pingChecking}
          style={{ marginTop: 16 }}
        >
          <Activity size={16} />
          {pingChecking ? "Testing..." : "Test Ping"}
        </button>

        {/* PING HISTORY TABLE */}
        <div style={{ marginTop: 25 }}>
          <div className="panel-heading">
            <div>
              <h2>Ping History</h2>
              <p>Recent connection measurements</p>
            </div>
          </div>

          <div className="system-monitor-list">
            {[...pingSamples].reverse().slice(0, 10).map((sample, index) => (
              <div className="monitor-metric" key={`${sample.time}-${index}`}>
                <div>
                  <span>{sample.time}</span>
                  <strong className={
                    sample.reachable ? "success-text" : "warning-text"
                  }>
                    {sample.reachable
                      ? `${sample.latency} ms`
                      : "Timeout"}
                  </strong>
                </div>
              </div>
            ))}

            {pingSamples.length === 0 && (
              <p>Waiting for first ping measurement...</p>
            )}
          </div>
        </div>
      </div>

      {/* TRAFFIC STATISTICS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>DOWNLOAD SPEED</span>
            <Network />
          </div>
          <strong>{network ? network.download_mbps.toFixed(2) : "--"}</strong>
          <small>Mbps incoming</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>UPLOAD SPEED</span>
            <Activity />
          </div>
          <strong>{network ? network.upload_mbps.toFixed(2) : "--"}</strong>
          <small>Mbps outgoing</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>TOTAL RECEIVED</span>
            <HardDrive />
          </div>
          <strong>
            {network ? `${network.total_received_mb.toFixed(2)} MB` : "--"}
          </strong>
          <small>Received traffic</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>TOTAL SENT</span>
            <HardDrive />
          </div>
          <strong>
            {network ? `${network.total_transmitted_mb.toFixed(2)} MB` : "--"}
          </strong>
          <small>Transmitted traffic</small>
        </div>
      </div>

      {/* TRAFFIC HISTORY */}
      <div className="performance-charts-grid">
        <PerformanceChart
          title="Download History"
          subtitle="Incoming network traffic"
          data={history.download}
          color="#38a6e8"
          suffix=" Mbps"
        />

        <PerformanceChart
          title="Upload History"
          subtitle="Outgoing network traffic"
          data={history.upload}
          color="#26c99a"
          suffix=" Mbps"
        />
      </div>

      {/* NETWORK ADAPTERS */}
      <div className="panel monitor-panel">
        <div className="panel-heading">
          <div>
            <h2>Network Adapters</h2>
            <p>Local IPv4 / IPv6 and MAC information</p>
          </div>
          <Network />
        </div>

        {adapterError && (
          <p className="warning-text">{adapterError}</p>
        )}

        {adapters.length === 0 ? (
          <p>No active network adapters found.</p>
        ) : (
          <div className="system-monitor-list">
            {adapters.map((adapter, index) => (
              <div
                className="monitor-metric"
                key={`${adapter.name}-${adapter.ip_address}-${index}`}
              >
                <div>
                  <span>{adapter.name}</span>
                  <strong className="success-text">
                    {adapter.connected ? "Available" : "Unavailable"}
                  </strong>
                </div>

                <div className="info-list">
                  <div>
                    <span>{adapter.address_type} Address</span>
                    <strong>{adapter.ip_address}</strong>
                  </div>
                  <div>
                    <span>MAC Address</span>
                    <strong>{adapter.mac_address}</strong>
                  </div>
                  <div>
                    <span>Connection</span>
                    <strong>
                      {adapter.connected ? "Active interface" : "Inactive"}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

{/* NETWORK DIAGNOSTICS */}
<div className="panel monitor-panel">
  <div className="panel-heading">
    <div>
      <h2>Network Diagnostics</h2>
      <p>Gateway, DNS and connectivity information</p>
    </div>
    <Activity />
  </div>

  <div className="stats-grid">
    <div className="stat-card">
      <div className="stat-top">
        <span>DEFAULT GATEWAY</span>
        <Network />
      </div>
      <strong style={{ fontSize: 18 }}>
        {diagnostics?.gateway ?? "--"}
      </strong>
      <small>Router address</small>
    </div>

    <div className="stat-card">
      <div className="stat-top">
        <span>INTERNET ACCESS</span>
        <Activity />
      </div>
      <strong className={
        diagnostics?.internet_available
          ? "success-text"
          : "warning-text"
      }>
        {diagnostics
          ? diagnostics.internet_available
            ? "Available"
            : "Unavailable"
          : "Checking"}
      </strong>
      <small>TCP connectivity test</small>
    </div>
  </div>

  <div style={{ marginTop: 22 }}>
    <h3>DNS Servers</h3>
    <div className="system-monitor-list">
      {diagnostics?.dns_servers.length ? (
        diagnostics.dns_servers.map((server, index) => (
          <div className="monitor-metric" key={`${server}-${index}`}>
            <div>
              <span>DNS Server {index + 1}</span>
              <strong>{server}</strong>
            </div>
          </div>
        ))
      ) : (
        <p>DNS servers unavailable.</p>
      )}
    </div>
  </div>

  <div style={{ marginTop: 24 }}>
    <h3>DNS Lookup</h3>
    <p style={{ color: "#8e9aaf", fontSize: 13 }}>
      Resolve a domain into IP addresses.
    </p>

    <div style={{
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 12
    }}>
      <input
        value={dnsHost}
        onChange={(e) => setDnsHost(e.target.value)}
        placeholder="example.com"
        style={{
          flex: 1,
          minWidth: 180,
          padding: 13,
          borderRadius: 8,
          border: "1px solid #29313d",
          background: "#0d1119",
          color: "#fff"
        }}
      />

      <button
        className="primary-button"
        onClick={runDnsLookup}
        disabled={dnsLoading || !dnsHost.trim()}
      >
        {dnsLoading ? "Resolving..." : "Lookup"}
      </button>
    </div>

    {dnsResults.length > 0 && (
      <div className="system-monitor-list" style={{ marginTop: 14 }}>
        {dnsResults.map((ip, index) => (
          <div className="monitor-metric" key={`${ip}-${index}`}>
            <div>
              <span>Resolved IP {index + 1}</span>
              <strong>{ip}</strong>
            </div>
          </div>
        ))}
      </div>
    )}

    {dnsResults.length === 0 && !dnsLoading && (
      <p style={{ color: "#8e9aaf", fontSize: 13, marginTop: 12 }}>
        No lookup results yet.
      </p>
    )}
  </div>
</div>


{/* TRACEROUTE MONITOR */}
<div className="panel monitor-panel">
  <div className="panel-heading">
    <div>
      <h2>Traceroute Monitor</h2>
      <p>Trace the network route to a destination</p>
    </div>
    <Network />
  </div>

  <div style={{
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18
  }}>
    <input
      value={traceHost}
      onChange={(e) => setTraceHost(e.target.value)}
      placeholder="Domain or IP address"
      style={{
        flex: 1,
        minWidth: 180,
        padding: 13,
        borderRadius: 8,
        border: "1px solid #29313d",
        background: "#0d1119",
        color: "#fff"
      }}
    />

    <button
      className="primary-button"
      onClick={runTrace}
      disabled={traceLoading || !traceHost.trim()}
    >
      {traceLoading ? "Tracing..." : "Start Traceroute"}
    </button>
  </div>

  <div className="system-monitor-list" style={{ marginTop: 20 }}>
    {traceResults.map((line, index) => (
      <div className="monitor-metric" key={`${index}-${line}`}>
        <span style={{
          color: "#38a6e8",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap"
        }}>
          {line}
        </span>
      </div>
    ))}

    {traceResults.length === 0 && (
      <p>Enter a destination and start traceroute.</p>
    )}
  </div>
</div>
{/* CONNECTION FILTERS */}
<div style={{
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
  marginBottom: 18
}}>
  <input
    value={connectionSearch}
    onChange={(e) => setConnectionSearch(e.target.value)}
    placeholder="Search process, IP or PID..."
    style={{
      padding: 12,
      borderRadius: 8,
      border: "1px solid #29313d",
      background: "#0d1119",
      color: "#fff",
      minWidth: 0
    }}
  />

  <select
    value={protocolFilter}
    onChange={(e) => setProtocolFilter(e.target.value)}
    style={{
      padding: 12,
      borderRadius: 8,
      background: "#0d1119",
      color: "#fff",
      border: "1px solid #29313d"
    }}
  >
    <option value="ALL">All Protocols</option>
    <option value="TCP">TCP</option>
    <option value="UDP">UDP</option>
  </select>

  <select
    value={stateFilter}
    onChange={(e) => setStateFilter(e.target.value)}
    style={{
      padding: 12,
      borderRadius: 8,
      background: "#0d1119",
      color: "#fff",
      border: "1px solid #29313d"
    }}
  >
    <option value="ALL">All States</option>
    <option value="ESTABLISHED">Established</option>
    <option value="LISTENING">Listening</option>
    <option value="TIME_WAIT">Time Wait</option>
    <option value="CLOSE_WAIT">Close Wait</option>
    <option value="BOUND">UDP Bound</option>
  </select>

  <select
    value={connectionSort}
    onChange={(e) => setConnectionSort(e.target.value)}
    style={{
      padding: 12,
      borderRadius: 8,
      background: "#0d1119",
      color: "#fff",
      border: "1px solid #29313d"
    }}
  >
    <option value="process">Sort: Process</option>
    <option value="pid">Sort: PID</option>
    <option value="state">Sort: State</option>
  </select>
</div>

<div style={{
  color: "#8e9aaf",
  fontSize: 13,
  marginBottom: 14
}}>
  Showing {filteredConnections.length} of {activeConnections.length} connections
</div>

{/* ACTIVE CONNECTIONS */}
<div className="panel monitor-panel">
  <div className="panel-heading">
    <div>
      <h2>Active Connections</h2>
      <p>Live TCP/UDP connections and associated processes</p>
    </div>
    <Network />
  </div>

  <div className="info-list" style={{ marginBottom: 18 }}>
    <div>
      <span>Active Connections</span>
      <strong>{activeConnections.length}</strong>
    </div>
    <div>
      <span>Last Refresh</span>
      <strong>{new Date().toLocaleTimeString()}</strong>
    </div>
  </div>

  <button
    className="primary-button"
    onClick={loadActiveConnections}
    disabled={connectionsLoading}
  >
    <Activity size={16} />
    {connectionsLoading ? "Refreshing..." : "Refresh Connections"}
  </button>

  <div className="system-monitor-list" style={{ marginTop: 18 }}>
    {activeConnections.length > 0 ? (
      filteredConnections.map((connection, index) => (
        <div
          className="monitor-metric"
          key={`${connection.pid}-${connection.local_address}-${index}`}
        >
          <div>
            <span>{connection.process_name}</span>
            <strong className="success-text">
              {connection.state}
            </strong>
            <button
  className="primary-button"
  style={{ marginTop: 8 }}
  onClick={() => {
    console.log("VIEW DETAILS CLICKED", connection);
    setSelectedConnection(connection);
  }}
>
  View Details
</button>
          </div>

          <div className="info-list">
            <div>
              <span>Protocol</span>
              <strong>{connection.protocol}</strong>
            </div>
            <div>
              <span>Local Address</span>
              <strong>{connection.local_address}</strong>
            </div>
            <div>
              <span>Remote Address</span>
              <strong>{connection.remote_address}</strong>
            </div>
            <div>
              <span>Process ID</span>
              <strong>{connection.pid}</strong>
            </div>
          </div>
        </div>
      ))
    ) : (
      <p>No active TCP connections found.</p>
    )}
  </div>

  {/* CONNECTION DETAILS */}
  {selectedConnection && (
    <div className="panel monitor-panel" style={{ marginTop: 20 }}>
      <div className="panel-heading">
        <div>
          <h2>Connection Details</h2>
          <p>Selected network connection information</p>
        </div>
        <Network />
      </div>

      <div className="info-list">
        <div>
          <span>Process</span>
          <strong>{selectedConnection.process_name}</strong>
        </div>
        <div>
          <span>Protocol</span>
          <strong>{selectedConnection.protocol}</strong>
        </div>
        <div>
          <span>Local Address</span>
          <strong>{selectedConnection.local_address}</strong>
        </div>
        <div>
          <span>Remote Address</span>
          <strong>{selectedConnection.remote_address}</strong>
        </div>
        <div>
          <span>Process ID</span>
          <strong>{selectedConnection.pid}</strong>
        </div>
        <div>
          <span>State</span>
          <strong className="success-text">
            {selectedConnection.state}
          </strong>
        </div>
      </div>

      <button
        className="primary-button"
        style={{ marginTop: 16 }}
        onClick={() => setSelectedConnection(null)}
      >
        Close Details
      </button>
    </div>
  )}
</div>

      {/* NETWORK INFORMATION */}
      <div className="panel monitor-panel">
        <div className="panel-heading">
          <div>
            <h2>Network Information</h2>
            <p>Local traffic statistics</p>
          </div>
          <Activity />
        </div>

        <div className="info-list">
          <div>
            <span>Internet</span>
            <strong className={statusColor}>{internetStatus}</strong>
          </div>
          <div>
            <span>Data source</span>
            <strong>Local system interfaces</strong>
          </div>
          <div>
            <span>Refresh interval</span>
            <strong>2 seconds</strong>
          </div>
          <div>
            <span>Public IP provider</span>
            <strong>api.ipify.org</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

type ActivityLog = {
  timestamp: string;
  level: string;
  message: string;
};

function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    setLoading(true);

    try {
      const result = await invoke<ActivityLog[]>("get_activity_logs");
      setLogs(result);
      setError("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">SYSTEM AUDIT</div>
          <h1>Activity Logs</h1>
          <p>Application activity and security events.</p>
        </div>

        <button
          className="icon-button"
          onClick={loadLogs}
          disabled={loading}
          title="Refresh logs"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="panel">
        <h3>Activity History</h3>

        {error && <p className="warning-text">{error}</p>}

        {!error && logs.length === 0 && (
          <p>No activity records available yet.</p>
        )}

        {logs.map((log, index) => (
          <div
            key={index}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid #292d38",
            }}
          >
            <strong>{log.level}</strong>
            <span style={{ marginLeft: 12, opacity: 0.6 }}>
              {new Date(Number(log.timestamp) * 1000).toLocaleString("az-AZ")}
            </span>
            <p>{log.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
function SettingsPage({
  autoRefresh,
  setAutoRefresh,
  refreshInterval,
  setRefreshInterval,
}: {
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  refreshInterval: number;
  setRefreshInterval: (value: number) => void;
}) {
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">APPLICATION CONFIGURATION</div>
          <h1>Settings</h1>
          <p>Configure your NOBODY Control Center preferences.</p>
        </div>
      </div>

      <div className="panel">
        <h3>General Settings</h3>

        <div style={{ padding: "20px 0" }}>
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => {
                const value = e.target.checked;
                setAutoRefresh(value);
                localStorage.setItem("nobody_auto_refresh", String(value));
              }}
            />
            <span style={{ marginLeft: 12 }}>Auto Refresh</span>
          </label>
        </div>

        <div style={{ padding: "20px 0" }}>
          <label htmlFor="refresh-interval">Refresh Interval</label>

          <select
            id="refresh-interval"
            value={refreshInterval}
            onChange={(e) => {
              const value = Number(e.target.value);
              setRefreshInterval(value);
              localStorage.setItem("nobody_refresh_interval", String(value));
            }}
            style={{
              display: "block",
              marginTop: 12,
              padding: 12,
              background: "#151922",
              color: "#fff",
              border: "1px solid #303644",
              borderRadius: 8,
              width: 220,
            }}
          >
            <option value={2}>2 seconds</option>
            <option value={3}>3 seconds</option>
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
          </select>
        </div>
      </div>
    </div>
  );
}
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-page">
      <div className="page-eyebrow">NOBODY CONTROL CENTER</div>
      <h1>{title}</h1>
      <p>This module is not implemented yet.</p>
      <div className="placeholder-icon"><Settings size={32} /></div>
      <span>Module initialization pending</span>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [autoRefresh, setAutoRefresh] = useState(
  () => localStorage.getItem("nobody_auto_refresh") !== "false"
);

const [refreshInterval, setRefreshInterval] = useState(
  () => Number(localStorage.getItem("nobody_refresh_interval")) || 3
);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [monitor, setMonitor] = useState<SystemMonitor | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([]);
  const [adapterError, setAdapterError] = useState<string | null>(null);

  const [history, setHistory] = useState<PerformanceHistory>({
    cpu: [],
    ram: [],
    download: [],
    upload: [],
  });

  // Dashboard system information
  useEffect(() => {
    const loadInfo = async () => {
      try {
        const result = await invoke<SystemInfo>("get_system_info");
        setInfo(result);
      } catch (error) {
        console.error("System information error:", error);
      }
    };

    loadInfo();

    const interval = window.setInterval(loadInfo, 3000);

    return () => window.clearInterval(interval);
  }, []);

  
  // Live system monitor and network history
  useEffect(() => {
    if (activePage !== "System Monitor" && activePage !== "Network") return;

    let mounted = true;

    const loadMonitor = async () => {
      try {
        const result = await invoke<SystemMonitor>("get_system_monitor");

        if (!mounted) return;

        setMonitor(result);
        setMonitorError(null);

        setHistory((previous) => ({
          cpu: [...previous.cpu, result.cpu_usage].slice(-30),
          ram: [...previous.ram, result.memory_percent].slice(-30),
          download: [...previous.download, result.network.download_mbps].slice(-30),
          upload: [...previous.upload, result.network.upload_mbps].slice(-30),
        }));
      } catch (error) {
        if (mounted) {
          setMonitorError(String(error));
          console.error("Monitor error:", error);
        }
      }
    };

    loadMonitor();

    const interval = autoRefresh
  ? window.setInterval(loadMonitor, refreshInterval * 1000)
  : undefined;

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [activePage, autoRefresh, refreshInterval]);

// Load local network adapters
useEffect(() => {
  if (activePage !== "Network") return;

  let mounted = true;

  const loadAdapters = async () => {
    try {
      const result = await invoke<NetworkAdapter[]>("get_network_adapters");

      if (!mounted) return;

      setAdapters(result);
      setAdapterError(null);
    } catch (error) {
      if (mounted) {
        setAdapterError(String(error));
        console.error("Network adapter error:", error);
      }
    }
  };

  loadAdapters();

  const interval = window.setInterval(loadAdapters, 5000);

  return () => {
    mounted = false;
    window.clearInterval(interval);
  };
}, [activePage]);
  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return <DashboardPage info={info} />;

      case "Devices":
        return <Devices />;

    
      case "System Monitor":
        return (
          <SystemMonitorPage
            monitor={monitor}
            error={monitorError}
            history={history}
          />
        );

            case "Network":
           return (
          <NetworkPage
            monitor={monitor}
            error={monitorError}
            history={history}
            adapters={adapters}
            adapterError={adapterError}
          />
        );
case "Security Center":
  return <SecurityCenter />;
case "Agent Builder":
  return <AgentBuilder />;
case "Remote Desktop":
  return <RemoteDesktop />;
case "Activity Logs":
  return <ActivityLogsPage />;
  case "File Manager":
  return <FileManager />;
  case "Terminal":
  return <TerminalPage />;
case "Settings":
  return (
    <SettingsPage
      autoRefresh={autoRefresh}
      setAutoRefresh={setAutoRefresh}
      refreshInterval={refreshInterval}
      setRefreshInterval={setRefreshInterval}
    />
  );

default:
  return <PlaceholderPage title={activePage} />;
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-hidden"}`}>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div className="brand-text">
            <strong>NOBODY</strong>
            <span>CONTROL CENTER</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`nav-item ${activePage === item.name ? "active" : ""}`}
                onClick={() => setActivePage(item.name)}
              >
                <Icon size={18} />
                <span>{item.name}</span>
                {activePage === item.name && <span className="nav-active-mark" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user-icon">R</div>
          <div>
            <strong>Administrator</strong>
            <small>Local session</small>
          </div>
          <div className="user-status" />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={19} />
            </button>

            <div className="breadcrumb">
              NOBODY <span>/</span> {activePage.toUpperCase()}
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-search">
              <Search size={16} />
              <span>Search...</span>
            </div>

            <button className="icon-button">
              <Bell size={18} />
            </button>

            <div className="topbar-avatar">R</div>
          </div>
        </header>

        <section className="content-area">
          {renderPage()}
        </section>

        <footer className="app-footer">
          <span><span className="footer-dot" /> NOBODY SYSTEM READY</span>
          <span>
            LOCAL WORKSTATION <span className="footer-separator">•</span> v0.1.0
          </span>
        </footer>
      </main>
    </div>
  );
}
