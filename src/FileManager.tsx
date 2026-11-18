
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Folder, File, ArrowLeft, RefreshCw } from "lucide-react";

type FileEntry = {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
};

export default function FileManager() {
  const [path, setPath] = useState("C:\\Users");
  const [address, setAddress] = useState("C:\\Users");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadFiles = async (directory: string) => {
    setLoading(true);

    try {
      const result = await invoke<FileEntry[]>("list_local_files", {
        path: directory,
      });

      setFiles(result);
      setSelectedFile(null);
      setPath(directory);
      setAddress(directory);
      setError("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles("C:\\Users");
  }, []);

  const goBack = () => {
    const parent = path.replace(/[\\/][^\\/]+[\\/]?$/, "");
    if (parent && parent !== path) {
      loadFiles(parent);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">LOCAL FILE SYSTEM</div>
          <h1>File Manager</h1>
          <p>Browse files and folders on this workstation.</p>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <button className="icon-button" onClick={goBack}>
            <ArrowLeft size={18} />
          </button>

          <input
  value={address}
  onChange={(e) => setAddress(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      loadFiles(address);
    }
  }}
  placeholder="Enter folder path..."
  style={{
    flex: 1,
    minWidth: 0,
    padding: 12,
    background: "#151922",
    color: "#fff",
    border: "1px solid #303644",
    borderRadius: 8,
  }}
/>

          <button
            className="icon-button"
            onClick={() => loadFiles(path)}
          >
            <RefreshCw size={18} />
          </button>
        </div>
<input
  type="text"
  placeholder="Search files and folders..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={{
    width: "100%",
    padding: 12,
    marginBottom: 16,
    background: "#151922",
    color: "#fff",
    border: "1px solid #303644",
    borderRadius: 8,
    boxSizing: "border-box",
  }}
/>
{selectedFile && (
  <div
    style={{
      padding: 20,
      marginBottom: 20,
      background: "#151922",
      border: "1px solid #303644",
      borderRadius: 10,
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <h3>File Details</h3>

      <button
        className="icon-button"
        onClick={() => setSelectedFile(null)}
      >
        ✕
      </button>
    </div>

    <p><strong>Name:</strong> {selectedFile.name}</p>
    <p><strong>Path:</strong> {selectedFile.path}</p>
    <p><strong>Type:</strong> File</p>
    <p>
      <strong>Size:</strong>{" "}
      {(selectedFile.size / 1024).toFixed(2)} KB
    </p>
  </div>
)}
        {loading && <p>Loading files...</p>}
        {error && <p className="warning-text">{error}</p>}

        {!loading && files
  .filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  )
  .map((item) => (
          <div
            key={item.path}
            onClick={() => {
  if (item.is_directory) {
    loadFiles(item.path);
  } else {
    setSelectedFile(item);
  }
}}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderBottom: "1px solid #292d38",
              cursor: item.is_directory ? "pointer" : "default"
            }}
          >
            {item.is_directory
              ? <Folder size={20} color="#f5b942" />
              : <File size={20} />}

            <span style={{ flex: 1 }}>{item.name}</span>

            {!item.is_directory && (
              <span style={{ opacity: 0.6 }}>
                {(item.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
