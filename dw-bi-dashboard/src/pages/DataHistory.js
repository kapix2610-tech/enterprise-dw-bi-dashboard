import { useCallback, useEffect, useState } from "react";
import AnalyticsHeader from "../components/AnalyticsHeader";
import { API_URL } from "../config";

async function parseResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function DataHistory({ token, workspaceId, workspaces = [], onAddData, onOpenDataset, onDeletedDatasets }) {
  const [files, setFiles] = useState([]);
  const [historyScope, setHistoryScope] = useState(workspaceId);
  const [range, setRange] = useState("7");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedDataset, setSelectedDataset] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/files`, { headers: { Authorization: `Bearer ${token}` } });
      setFiles(await parseResponse(response));
    } catch (error) {
      setMessage(error.message || "Could not load dataset history.");
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setHistoryScope(workspaceId); }, [workspaceId]);

  const openDataset = async (fileId) => {
    setSelectedId(fileId);
    setSelectedDataset(null);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/files/${fileId}`, { headers: { Authorization: `Bearer ${token}` } });
      const dataset = await parseResponse(response);
      setSelectedDataset(dataset);
    } catch (error) {
      setSelectedId("");
      setMessage(error.message || "Could not open this dataset.");
    }
  };

  const deleteDataset = async (file) => {
    if (!window.confirm(`Delete "${file.originalName}" and its saved chat/report history? This cannot be undone.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/files/${file._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await parseResponse(response);
      onDeletedDatasets([file._id]);
      if (selectedId === file._id) {
        setSelectedId("");
        setSelectedDataset(null);
      }
      const confirmationMessage = result.cleanupFailures
        ? `Dataset deleted, but ${result.cleanupFailures} stored file could not be cleaned up.`
        : `"${file.originalName}" and its related history were deleted.`;
      await load();
      setMessage(confirmationMessage);
    } catch (error) {
      setMessage(error.message || "Could not delete this dataset.");
      setBusy(false);
    }
  };

  const removeHistory = async () => {
    const scopeLabel = historyScope === "all" ? "across all workspaces" : "in this workspace";
    if (!window.confirm(range === "all"
      ? `Delete every dataset ${scopeLabel}, including related chat and reports? This cannot be undone.`
      : `Delete datasets older than ${range} days ${scopeLabel}, including related chat and reports? This cannot be undone.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          days: range === "all" ? "all" : Number(range),
          ...(historyScope !== "all" ? { workspaceId: historyScope } : {}),
        }),
      });
      const result = await parseResponse(response);
      onDeletedDatasets(result.deletedIds || []);
      setSelectedId("");
      setSelectedDataset(null);
      const confirmationMessage = result.cleanupFailures
        ? `${result.deleted} dataset(s) deleted; ${result.cleanupFailures} stored file(s) need cleanup.`
        : `${result.deleted} dataset record(s) and their related history deleted.`;
      await load();
      setMessage(confirmationMessage);
    } catch (error) {
      setMessage(error.message || "Could not delete dataset history.");
      setBusy(false);
    }
  };

  const headers = selectedDataset?.columns || [];
  const sampleRows = selectedDataset?.rows || [];
  const visibleFiles = files.filter((file) => historyScope === "all" || (file.workspaceId || "default") === historyScope);
  const workspaceNames = new Map(workspaces.map((item) => [item.id, item.category]));
  const archivedWorkspaceIds = [...new Set(files.map((file) => file.workspaceId || "default"))]
    .filter((id) => !workspaceNames.has(id));

  return (
    <div className="analytics-page">
      <AnalyticsHeader eyebrow="WORKSPACE HISTORY" title="Data history" subtitle="Browse, open, or delete datasets saved in your private workspaces." actionLabel="Add data" onAction={onAddData} onSecondary={load} secondaryLabel="Refresh history" />
      <div className="history-toolbar">
        <div><strong>{visibleFiles.length} uploaded dataset{visibleFiles.length === 1 ? "" : "s"}</strong><p>Workspace settings can be removed without deleting saved data.</p></div>
        <div className="history-delete">
          <select value={historyScope} onChange={(event) => setHistoryScope(event.target.value)} aria-label="Filter history by workspace">
            {workspaces.map((item) => <option value={item.id} key={item.id}>{item.category}</option>)}
            <option value="all">All workspaces</option>
            {archivedWorkspaceIds.map((id) => <option value={id} key={id}>Saved data · {id === "default" ? "Previous workspace" : id.slice(0, 18)}</option>)}
          </select>
          <select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Delete older datasets">
            <option value="3">Older than 3 days</option><option value="5">Older than 5 days</option><option value="7">Older than 7 days</option><option value="30">Older than 30 days</option><option value="365">Older than 1 year</option><option value="all">All history</option>
          </select>
          <button onClick={removeHistory} disabled={busy || files.length === 0}>Delete history</button>
        </div>
      </div>
      {message && <div className="history-message" role="status">{message}</div>}
      <section className="analytics-panel table-panel">
        <div className="data-table-wrap">
          <table className="pro-table">
            <thead><tr><th>Dataset</th><th>Uploaded</th><th>Records</th><th>Columns</th><th>Size</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleFiles.length ? visibleFiles.map((file) => (
                <tr key={file._id}>
                  <td><strong>{file.originalName}</strong><small>{file.mimeType || "Uploaded file"}</small></td>
                  <td>{new Date(file.createdAt).toLocaleString()}</td>
                  <td>{file.rowCount?.toLocaleString() || 0}</td>
                  <td>{file.columns?.length || 0} fields</td>
                  <td>{Math.round((file.size || 0) / 1024)} KB</td>
                  <td className="history-row-actions">
                    <button type="button" onClick={() => openDataset(file._id)} disabled={busy}>{selectedId === file._id ? "Loading…" : "View data"}</button>
                    <button type="button" onClick={() => deleteDataset(file)} disabled={busy} aria-label={`Delete ${file.originalName}`}>Delete</button>
                  </td>
                </tr>
              )) : <tr><td colSpan="6" className="history-empty">{busy ? "Loading saved dataset history…" : "No uploaded data yet. Your dataset history will appear here."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {selectedDataset && (
        <section className="analytics-panel table-panel history-preview">
          <div className="panel-heading">
            <div><h2>{selectedDataset.filename}</h2><p>{selectedDataset.rowCount.toLocaleString()} rows · Showing up to {sampleRows.length.toLocaleString()} rows</p></div>
            <div className="history-preview-actions">
              <button type="button" onClick={() => {
                const opened = onOpenDataset(selectedDataset);
                if (opened === false) setMessage("This dataset belongs to a deleted workspace setup. Its data is safe; create a matching workspace to open it on the dashboard.");
              }}>Open on dashboard</button>
              <button type="button" onClick={() => { setSelectedId(""); setSelectedDataset(null); }}>Close preview</button>
            </div>
          </div>
          <div className="data-table-wrap">
            <table className="pro-table">
              <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>{sampleRows.map((row, rowIndex) => <tr key={`${selectedDataset.fileId}-${rowIndex}`}>{headers.map((header) => <td key={header}>{String(row[header] ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default DataHistory;
