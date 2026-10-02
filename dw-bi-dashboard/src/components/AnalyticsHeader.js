function AnalyticsHeader({ eyebrow, title, subtitle, actionLabel = "Export report", onAction, secondaryLabel = "Refresh", onSecondary }) {
  return <section className="analytics-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div><div className="analytics-header-actions"><button className="analytics-secondary" onClick={onSecondary}>↻ <span>{secondaryLabel}</span></button><button className="analytics-primary" onClick={onAction}>↓ <span>{actionLabel}</span></button></div></section>;
}

export default AnalyticsHeader;
