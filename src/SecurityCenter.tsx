import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ShieldCheck,
  ShieldAlert,
  Flame,
  Lock,
  RefreshCw,
  Cpu,
  Bug,
  Timer,
} from "lucide-react";

type SecurityStatus = {
  hostname: string;
  os_version: string;
  defender_enabled: boolean;
  realtime_protection: boolean;
  antivirus_name: string | null;
  firewall_enabled: boolean;
  bitlocker_status: string;
  last_scan: string | null;
  uptime_days: number;
};

const ok = (value: boolean) => (value ? "#22c55e" : "#ef4444");

export default function SecurityCenter() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const result = await invoke<SecurityStatus>(
        "get_windows_security_status"
      );
      setStatus(result);
      setError("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">LOCAL HARDENING</div>
          <h1>Security Center</h1>
          <p>Live posture of the local Windows host.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>DEFENDER</span>
            <ShieldCheck />
          </div>
          <strong style={{ color: ok(!!status?.defender_enabled) }}>
            {status ? (status.defender_enabled ? "Enabled" : "Disabled") : "—"}
          </strong>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>REALTIME SHIELD</span>
            <Bug />
          </div>
          <strong style={{ color: ok(!!status?.realtime_protection) }}>
            {status
              ? status.realtime_protection
                ? "Active"
                : "Inactive"
              : "—"}
          </strong>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>FIREWALL</span>
            <Flame />
          </div>
          <strong style={{ color: ok(!!status?.firewall_enabled) }}>
            {status
              ? status.firewall_enabled
                ? "All profiles on"
                : "Profiles open"
              : "—"}
          </strong>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>BITLOCKER</span>
            <Lock />
          </div>
          <strong style={{ color: "#94a3b8" }}>
            {status?.bitlocker_status ?? "—"}
          </strong>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <div>
            <h2>Host Detail</h2>
            <p>Refreshed every 15 seconds.</p>
          </div>

          <button
            className="icon-button"
            onClick={load}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 12 }}>
          {error && <p style={{ color: "#ef4444" }}>{error}</p>}

          {status && (
            <>
              <Row icon={<Cpu size={16} />} label="Host">
                {status.hostname}
              </Row>

              <Row icon={<Cpu size={16} />} label="Operating system">
                {status.os_version}
              </Row>

              <Row icon={<ShieldAlert size={16} />} label="Antivirus">
                {status.antivirus_name ?? "Not reported"}
              </Row>

              <Row icon={<Timer size={16} />} label="Uptime">
                {status.uptime_days} days
              </Row>

              <Row icon={<Timer size={16} />} label="Last quick scan">
                {status.last_scan
                  ? new Date(status.last_scan).toLocaleString()
                  : "Never"}
              </Row>
            </>
          )}

          {!status && !error && (
            <p style={{ color: "#94a3b8" }}>Reading host posture…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "#10131a",
        border: "1px solid #303644",
        borderRadius: 8,
        color: "#cbd5e1",
      }}
    >
      <span style={{ color: "#64748b" }}>{icon}</span>
      <span style={{ color: "#64748b", minWidth: 160 }}>{label}</span>
      <strong style={{ fontWeight: 500 }}>{children}</strong>
    </div>
  );
}