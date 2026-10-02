import { useState } from "react";

function DataImportModal({ onClose, onAnalyze }) {
  const [activeTab, setActiveTab] = useState("upload");
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [text, setText] = useState("date,product,region,revenue,units\n2026-08-01,Product A,North,60000,120\n2026-08-02,Product B,South,42500,85");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!text.trim()) {
      setError("Add a CSV or JSON dataset before analyzing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAnalyze(selectedFile || new File([text], "manual-dataset.csv", { type: "text/csv" }), text, fileName || "Manual dataset");
    } catch (analysisError) {
      setError(analysisError.message || "Could not save this dataset.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><section className="data-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="modal-top"><div><span className="eyebrow">DATA STUDIO</span><h2 id="import-title">Add data to your workspace</h2><p>Drop in a dataset and Datawise will find the key metrics and trends.</p></div><button className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}>×</button></div><div className="import-tabs"><button className={activeTab === "upload" ? "selected" : ""} onClick={() => setActiveTab("upload")} disabled={busy}>Upload file</button><button className={activeTab === "paste" ? "selected" : ""} onClick={() => setActiveTab("paste")} disabled={busy}>Paste data</button></div>{activeTab === "upload" ? <label className="drop-zone"><input type="file" accept=".csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleFile} disabled={busy} /><span className="drop-icon">↑</span><strong>{fileName || "Choose a CSV, Excel, or JSON file"}</strong><small>or drag and drop it here · Max 10 MB</small></label> : <textarea className="data-textarea" value={text} onChange={(event) => setText(event.target.value)} aria-label="Dataset" disabled={busy} />}{activeTab === "upload" && <div className="data-preview"><span className="preview-check">✓</span><div><strong>{fileName || "Sample sales dataset"}</strong><p>{fileName ? "File ready to analyze" : "CSV columns: date, product, region, revenue, units"}</p></div><button onClick={() => { setText(""); setFileName(""); setSelectedFile(null); }} aria-label="Clear dataset" disabled={busy}>×</button></div>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button analyze-button" onClick={handleSubmit} disabled={busy}>{busy ? "Saving dataset…" : "✦ Analyze data"}</button></div></section></div>;
}

export default DataImportModal;
