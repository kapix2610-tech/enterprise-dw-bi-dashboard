import AnalyticsHeader from "./AnalyticsHeader";

function DataRequired({ eyebrow, title, subtitle, onAddData }) {
  return <div className="analytics-page"><AnalyticsHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actionLabel="Add data" onAction={onAddData} onSecondary={onAddData} secondaryLabel="Connect source" /><div className="section-empty"><div className="empty-hero-icon">✦</div><span className="eyebrow">WAITING FOR YOUR DATA</span><h2>This view will come alive after upload.</h2><p>Connect a CSV or Excel dataset to unlock {title.toLowerCase()} metrics, charts and AI insights.</p><button className="primary-button" onClick={onAddData}>＋ Upload dataset</button></div></div>;
}

export default DataRequired;
