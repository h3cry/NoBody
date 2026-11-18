import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Cpu, Server, ShieldCheck, Package, Info } from "lucide-react";

export default function AgentBuilder() {
  const [agentName, setAgentName] = useState("NOBODY Agent");
  const [serverUrl, setServerUrl] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState("");

  const handleBuild = async () => {
    setBuilding(true);
    setBuildResult("");

    try {
      const path = await invoke<string>("build_agent", {
        agentName: agentName,
      });
      setBuildResult(`Build successful: ${path}`);
    } catch (error) {
      setBuildResult(`Build failed: ${String(error)}`);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">AGENT MANAGEMENT</div>
          <h1>Agent Builder</h1>
          <p>Configure a NOBODY endpoint agent.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>BUILDER STATUS</span>
            <Package />
          </div>
          <strong>
            {building
              ? "Building..."
              : buildResult.startsWith("Build successful")
              ? "Ready"
              : "Not configured"}
          </strong>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>PLATFORM</span>
            <Cpu />
          </div>
          <strong>Windows x64</strong>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>ENROLLMENT</span>
            <ShieldCheck />
          </div>
          <strong>Automatic</strong>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <div>
            <h2>Agent Configuration</h2>
            <p>Configure the endpoint installer.</p>
          </div>
          <Server />
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>
          <label>
            <div style={{ marginBottom: 8 }}>Agent Name</div>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Agent name"
              style={{
                width: "100%",
                padding: 12,
                background: "#10131a",
                color: "#fff",
                border: "1px solid #303644",
                borderRadius: 8,
              }}
            />
          </label>

          <label>
            <div style={{ marginBottom: 8 }}>Cloud Server URL</div>
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-server.example"
              style={{
                width: "100%",
                padding: 12,
                background: "#10131a",
                color: "#fff",
                border: "1px solid #303644",
                borderRadius: 8,
              }}
            />
          </label>

          <button
            className="primary-button"
            onClick={handleBuild}
            disabled={building}
          >
            <Package size={17} />
            {building ? "Building..." : "Build Agent"}
          </button>

          {buildResult && (
            <p style={{ color: "#94a3b8", marginTop: 12 }}>
              {buildResult}
            </p>
          )}

          <p style={{ color: "#94a3b8", fontSize: 13 }}>
            <Info size={14} style={{ verticalAlign: "middle" }} />{" "}
            {buildResult.startsWith("Build successful")
              ? "Agent executable generated. It enrolls itself on first run."
              : "The agent registers automatically — no code needed."}
          </p>
        </div>
      </div>
    </div>
  );
}