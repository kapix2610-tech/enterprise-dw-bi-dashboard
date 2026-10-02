import React, { useCallback, useEffect, useState } from "react";
import { API_URL } from "../config";

const categories = ["All sources", "Most popular", "Files & feeds", "Cloud storage", "Databases", "CRM & sales", "Marketing", "Finance"];
const sources = [
  { name: "Local file", detail: "CSV, Excel or JSON", category: "Files & feeds", icon: "↑", tone: "blue", action: "upload" },
  { name: "Google Drive", detail: "Connect spreadsheets", category: "Cloud storage", icon: "G", tone: "green" },
  { name: "OneDrive", detail: "Import business files", category: "Cloud storage", icon: "◇", tone: "cyan" },
  { name: "PostgreSQL", detail: "Connect a database", category: "Databases", icon: "▣", tone: "navy" },
  { name: "MySQL", detail: "Connect a database", category: "Databases", icon: "◆", tone: "orange" },
  { name: "Salesforce", detail: "Import CRM data", category: "CRM & sales", icon: "☁", tone: "sky" },
  { name: "Shopify", detail: "Connect your store", category: "CRM & sales", icon: "S", tone: "lime" },
  { name: "REST API", detail: "Secure API · refreshes every 5 minutes", category: "Files & feeds", icon: "⌁", tone: "purple", action: "rest" },
  { name: "Google Ads", detail: "Campaign performance", category: "Marketing", icon: "A", tone: "orange" },
  { name: "Zoho Books", detail: "Invoices and expenses", category: "Finance", icon: "₹", tone: "green" },
];

async function readResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function DataSources({ token, workspaceId, onImport, onOpenDashboard, onSourceSynced }) {
  const [category, setCategory] = useState("Most popular");
  const [selected, setSelected] = useState("Local file");
  const [connections, setConnections] = useState([]);
  const [datasetCounts, setDatasetCounts] = useState({});
  const [showRestForm, setShowRestForm] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", token: "", rowsPath: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const visibleSources = category === "All sources" || category === "Most popular"
    ? sources
    : sources.filter((source) => source.category === category);

  const loadConnections = useCallback(async () => {
    try {
      const query = new URLSearchParams({ workspaceId });
      const [apiConnections, datasets] = await Promise.all([
        fetch(`${API_URL}/api/sources?${query}`, { headers: { Authorization: `Bearer ${token}` } }).then(readResponse),
        fetch(`${API_URL}/api/files`, { headers: { Authorization: `Bearer ${token}` } }).then(readResponse),
      ]);
      setConnections(apiConnections);
      setDatasetCounts(Object.fromEntries(datasets.map((file) => [file.sourceId, file.rowCount])));
    } catch (error) {
      setMessage(error.message || "Could not load connected API sources.");
    }
  }, [token, workspaceId]);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const chooseSource = (source) => {
    setSelected(source.name);
    if (source.action === "upload") onImport();
    if (source.action === "rest") {
      setMessage("");
      setShowRestForm(true);
    }
  };

  const connectRestApi = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await readResponse(await fetch(`${API_URL}/api/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, workspaceId }),
      }));
      setForm({ name: "", url: "", token: "", rowsPath: "" });
      setShowRestForm(false);
      setMessage("API connected. Automatic refresh is enabled every 5 minutes.");
      await onSourceSynced(result.dataset.fileId);
      await loadConnections();
    } catch (error) {
      setMessage(error.message || "Could not connect this API.");
      await loadConnections();
    } finally {
      setBusy(false);
    }
  };

  const refreshSource = async (sourceId) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await readResponse(await fetch(`${API_URL}/api/sources/${sourceId}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }));
      await onSourceSynced(result.dataset.fileId);
      setMessage(`Live data refreshed: ${result.dataset.rowCount.toLocaleString()} rows.`);
      await loadConnections();
    } catch (error) {
      setMessage(error.message || "Could not refresh this API source.");
      await loadConnections();
    } finally {
      setBusy(false);
    }
  };

  const disconnectSource = async (source) => {
    if (!window.confirm(`Disconnect "${source.name}" from this workspace? Its last synced dataset will be kept in Data history.`)) return;
    setBusy(true);
    setMessage("");
    try {
      await readResponse(await fetch(`${API_URL}/api/sources/${source.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }));
      setMessage("API disconnected. Its last synced dataset remains in Data history.");
      await loadConnections();
    } catch (error) {
      setMessage(error.message || "Could not disconnect this API.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sources-page">
      <div className="sources-hero">
        <div><span className="eyebrow">DATAWISE WORKSPACE</span><h1>Import your data</h1><p>Connect a source and turn raw information into a clear business view.</p></div>
        <div className="sources-hero-actions"><button className="outline-button" onClick={onOpenDashboard}>View dashboard <span>→</span></button><button className="primary-button" onClick={onImport}>＋ Upload file</button></div>
      </div>

      {message && <div className="history-message" role="status">{message}</div>}

      {connections.length > 0 && (
        <section className="analytics-panel live-source-panel">
          <div className="panel-heading">
            <div><span className="source-kicker">CONNECTED TO THIS WORKSPACE</span><h2>Live API source</h2><p>We check for new data every 5 minutes. Refresh now to fetch it immediately.</p></div>
            <span className="report-badge">↻ 5-minute sync</span>
          </div>
          {connections.map((connection) => (
            <article className="live-source-row" key={connection.id}>
              <div className="source-icon purple">⌁</div>
              <div className="live-source-info">
                <strong>{connection.name}</strong>
                <span>{connection.url}</span>
                <small>
                  {datasetCounts[connection.id] !== undefined ? `${datasetCounts[connection.id].toLocaleString()} rows` : "Waiting for first snapshot"}
                  {connection.lastSyncedAt ? ` · Last sync ${new Date(connection.lastSyncedAt).toLocaleString()}` : ""}
                </small>
                {connection.lastError && <small className="live-source-error">{connection.lastError}</small>}
              </div>
              <div className="live-source-actions">
                <button type="button" onClick={() => refreshSource(connection.id)} disabled={busy}>↻ Refresh now</button>
                <button type="button" onClick={() => disconnectSource(connection)} disabled={busy}>Disconnect</button>
              </div>
            </article>
          ))}
        </section>
      )}

      <div className="sources-layout">
        <aside className="source-categories">
          <div className="source-nav-title">Sources</div>
          {categories.map((item) => <button className={category === item ? "selected" : ""} key={item} onClick={() => setCategory(item)}><span>{item === "All sources" ? "▦" : item === "Most popular" ? "✦" : item === "Files & feeds" ? "□" : item === "Cloud storage" ? "☁" : item === "Databases" ? "▤" : item === "CRM & sales" ? "◯" : item === "Marketing" ? "◇" : "₹"}</span>{item}</button>)}
          <div className="source-tip"><span>✦</span><strong>AI-ready workspace</strong><p>Connect a live API or upload data to ask questions anytime.</p></div>
        </aside>
        <section className="source-browser">
          <div className="source-browser-head"><div><span className="source-kicker">{category.toUpperCase()}</span><h2>{category === "Most popular" ? "Choose a data source" : `${category} connections`}</h2><p>{category === "Most popular" ? "Connect a secure API or upload your own file." : `Connect your ${category.toLowerCase()} and keep related information together.`}</p></div><div className="source-search">⌕ <span>Search sources</span></div></div>
          <div className="source-grid">{visibleSources.map((source) => <button className={`source-card ${selected === source.name ? "active" : ""}`} key={source.name} onClick={() => chooseSource(source)}><span className={`source-icon ${source.tone}`}>{source.icon}</span><strong>{source.name}</strong><small>{source.detail}</small>{selected === source.name && <i className="source-check">✓</i>}</button>)}</div>
          <div className="source-footer"><div><span className="footer-spark">✦</span><div><strong>{visibleSources.length} connectors in this category</strong><p>REST data is fetched server-side; bearer credentials are never shown after saving.</p></div></div><button className="text-button" onClick={onImport}>Start with a file <span>→</span></button></div>
        </section>
        <aside className="walkthrough"><div className="walkthrough-orbit"><span>↗</span><span>▣</span><span>⌁</span><div>✦</div></div><span className="source-kicker">QUICK START</span><h2>From data to decisions</h2><p>Connect your business data. Datawise automatically refreshes connected API data every 5 minutes.</p><div className="walkthrough-steps"><div><b>01</b><span>Connect a source</span></div><div><b>02</b><span>Let AI analyze it</span></div><div><b>03</b><span>Ask better questions</span></div></div><button className="walkthrough-button" onClick={() => { setCategory("Most popular"); setSelected("REST API"); setShowRestForm(true); }}>Connect a live API <span>→</span></button></aside>
      </div>

      {showRestForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && setShowRestForm(false)}>
        <section className="data-modal live-api-modal" role="dialog" aria-modal="true" aria-labelledby="rest-api-title">
          <div className="modal-top"><div><span className="eyebrow">LIVE REST CONNECTION</span><h2 id="rest-api-title">Connect an API to this workspace</h2><p>Datawise fetches the latest JSON rows every 5 minutes.</p></div><button className="modal-close" onClick={() => setShowRestForm(false)} aria-label="Close" disabled={busy}>×</button></div>
          <form onSubmit={connectRestApi}>
            <label>Source name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Hospital visits API" maxLength={80} required /></label>
            <label>HTTPS API URL<input type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://api.example.com/v1/records" required /></label>
            <label>Bearer token<input type="password" autoComplete="new-password" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} placeholder="Paste the API bearer token" maxLength={4096} required /></label>
            <label>Rows path <span>Optional</span><input value={form.rowsPath} onChange={(event) => setForm({ ...form, rowsPath: event.target.value })} placeholder="data.records (default: data or root array)" maxLength={200} /></label>
            <p className="live-api-security">Only HTTPS APIs on the public internet are accepted. Credentials are encrypted in the backend database. The endpoint should return JSON records shaped like <code>{'{"data":[{"date":"2026-10-01","income":1200}]}'}</code>.</p>
            {message && <p className="form-error" role="alert">{message}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowRestForm(false)} disabled={busy}>Cancel</button><button className="primary-button analyze-button" type="submit" disabled={busy}>{busy ? "Testing API…" : "Test & connect"}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

export default DataSources;
