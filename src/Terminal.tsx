
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Terminal as TerminalIcon, Play, Trash2 } from "lucide-react";

const commands = ["whoami", "hostname", "ipconfig", "ping"] as const;

export default function Terminal() {
  const [command, setCommand] = useState<string>("whoami");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const runCommand = async () => {
    setLoading(true);

    try {
      const result = await invoke<string>("run_local_diagnostic", {
        command,
      });

      setOutput(result);
    } catch (error) {
      setOutput(`Error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">LOCAL DIAGNOSTICS</div>
          <h1>Terminal</h1>
          <p>Run approved diagnostics on this workstation.</p>
        </div>
      </div>

      <div className="panel">
        <h3>
          <TerminalIcon size={20} style={{ marginRight: 10 }} />
          Diagnostic Console
        </h3>

        <div style={{ display: "flex", gap: 12, margin: "24px 0" }}>
          <select
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            style={{
              flex: 1,
              padding: 12,
              background: "#151922",
              color: "#fff",
              border: "1px solid #303644",
              borderRadius: 8,
            }}
          >
            {commands.map((cmd) => (
              <option key={cmd} value={cmd}>
                {cmd}
              </option>
            ))}
          </select>

          <button
            className="icon-button"
            onClick={runCommand}
            disabled={loading}
            title="Run diagnostic"
          >
            <Play size={18} />
          </button>

          <button
            className="icon-button"
            onClick={() => setOutput("")}
            title="Clear output"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <pre
          style={{
            background: "#080b10",
            color: "#d7e2ef",
            padding: 20,
            borderRadius: 10,
            minHeight: 240,
            maxHeight: 450,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontFamily: "Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {loading
            ? "Running diagnostic..."
            : output || "Select a command and press Run."}
        </pre>
      </div>
    </div>
  );
}
