import AnalyticsHeader from "../components/AnalyticsHeader";

const content = {
  Reports: { eyebrow: "REPORTING HUB", title: "Reports & exports", subtitle: "Create polished executive views from your connected business data.", cards: [["Saved reports", "0", "Upload data to create your first report"], ["Scheduled reports", "Ready", "Set a recurring delivery cadence"], ["Report templates", "12", "Sales, finance and operations templates"]] },
  "Data quality": { eyebrow: "DATA GOVERNANCE", title: "Data quality center", subtitle: "Monitor completeness, consistency and trust across your workspace.", cards: [["Data health", "Waiting", "Add a dataset to calculate health"], ["Duplicate records", "—", "No dataset has been analyzed"], ["Validation rules", "8", "Standard checks are ready"]] },
  Alerts: { eyebrow: "PROACTIVE MONITORING", title: "Alerts & automation", subtitle: "Stay ahead of important changes with intelligent business signals.", cards: [["Active alerts", "0", "Alerts appear after data analysis"], ["Anomaly rules", "6", "Revenue and inventory rules ready"], ["Automations", "Ready", "Connect actions to your insights"]] },
};

function WorkspacePage({ page, onAddData }) {
  const view = content[page] || content.Reports;
  return <div className="analytics-page"><AnalyticsHeader eyebrow={view.eyebrow} title={view.title} subtitle={view.subtitle} actionLabel="Add data" onAction={onAddData} onSecondary={onAddData} secondaryLabel="Connect source" /><div className="workspace-empty-banner"><div className="empty-orbit-small">✦</div><div><strong>Your workspace is ready for data</strong><p>Upload a CSV or Excel file to activate {page.toLowerCase()} insights.</p></div><button onClick={onAddData}>Upload now →</button></div><div className="insight-stat-grid workspace-card-grid">{view.cards.map(([label, value, detail]) => <div className="insight-stat blue" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div><section className="analytics-panel workspace-guide"><div><span className="source-kicker">HOW IT WORKS</span><h2>Build your intelligence workspace</h2><p>Connect your data once. Datawise will organize it into reports, quality checks and proactive business alerts.</p></div><div className="guide-steps"><div><b>01</b><span>Upload a dataset</span></div><div><b>02</b><span>Review AI analysis</span></div><div><b>03</b><span>Turn insights into action</span></div></div></section></div>;
}

export default WorkspacePage;
