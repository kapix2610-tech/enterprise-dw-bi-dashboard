import React, { useState } from "react";
import {
  downloadReportAsDocx,
  downloadReportAsPdf,
  downloadReportAsPptx,
} from "./reportDownloads";

const money = (value) => {
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number.toLocaleString() : value;
};

function extractMetrics(content) {
  const patterns = [
    { label: "Total records", regex: /total records[^\d]*(\d[\d,]*)/i, tone: "blue" },
    { label: "Phone numeric total", regex: /phone[^\n]*total[^\d]*(\d[\d,]*)/i, tone: "orange" },
    { label: "Average phone value", regex: /average[^\n]*phone[^\d]*(\d[\d,.]*)/i, tone: "purple" },
    { label: "Email completeness", regex: /(\d{1,3})%[^\n]*(?:email|record)/i, tone: "green" },
  ];
  return patterns.map((item) => { const match = content.match(item.regex); return match ? { ...item, value: item.label.includes("completeness") ? `${match[1]}%` : money(match[1]) } : null; }).filter(Boolean);
}

function sectionTone(title) {
  if (/risk|anomal/i.test(title)) return "risk";
  if (/action|next|recommend/i.test(title)) return "action";
  if (/win|good|strength/i.test(title)) return "win";
  return "insight";
}

function cleanLine(line) {
  return line.replace(/^[-*•\d.)]+\s*/, "").replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function InsightReport({ content, analysis, metricNames, reportId, createdAt }) {
  const [exportState, setExportState] = useState("");
  const metrics = extractMetrics(content);
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections = [];
  let current = { title: "AI summary", items: [] };
  lines.forEach((line) => {
    const heading = line.match(/^#{1,4}\s+(.+)|^\*\*(.+?)\*\*\s*:?$/);
    if (heading) {
      if (current.items.length) sections.push(current);
      current = { title: (heading[1] || heading[2]).replace(/[:*_]/g, "").trim(), items: [] };
    } else if (!/^\|?\s*-{2,}/.test(line) && !/^\|\s*Category|^\|\s*Metric/i.test(line)) {
      const value = cleanLine(line.replace(/^\|\s*|\s*\|$/g, "").replace(/\s*\|\s*/g, " • "));
      if (value) current.items.push(value);
    }
  });
  if (current.items.length) sections.push(current);
  const isReport = metrics.length > 0 || sections.length > 1 || /weekly executive report|actionable recommendations/i.test(content);

  if (!isReport) return <div className="chat-plain-content">{content}</div>;

  const exportReport = async (format, download) => {
    setExportState(`Preparing ${format}…`);
    try {
      if (analysis) {
        await download(content, analysis, metricNames);
      } else {
        await download(content);
      }
      setExportState(`${format} downloaded`);
    } catch (error) {
      setExportState(`Could not create ${format}. Please try again.`);
    }
  };
  const generatedLabel = createdAt && Number.isFinite(Date.parse(createdAt))
    ? `Generated ${new Date(createdAt).toLocaleString()}`
    : "Generated from your uploaded dataset";

  return <div className="insight-report">
    <div className="insight-report-head">
      <div><span className="report-eyebrow">DATAWISE AI ANALYSIS</span><h3>Executive data brief</h3><p>{generatedLabel}{reportId ? ` · Report ${reportId}` : ""}</p></div>
      <span className="report-badge">✦ AI reviewed</span>
    </div>
    {metrics.length > 0 && <div className="report-metrics">{metrics.map((metric) => <div className={`report-metric ${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>from uploaded data</small></div>)}</div>}
    <div className="report-sections">{sections.slice(0, 6).map((section, index) => <article className={`report-section ${sectionTone(section.title)}`} key={`${section.title}-${index}`}><div className="report-section-title"><span>{sectionTone(section.title) === "risk" ? "!" : sectionTone(section.title) === "action" ? "→" : sectionTone(section.title) === "win" ? "✓" : "✦"}</span><h4>{section.title}</h4></div><ul>{section.items.slice(0, 8).map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{item}</li>)}</ul></article>)}</div>
    <div className="report-export">
      <span className="report-export-label">Download this report</span>
      <div className="report-export-buttons">
        <button type="button" onClick={() => exportReport("PPTX", downloadReportAsPptx)}>PowerPoint</button>
        <button type="button" onClick={() => exportReport("PDF", downloadReportAsPdf)}>PDF</button>
        <button type="button" onClick={() => exportReport("Word", downloadReportAsDocx)}>Word (.docx)</button>
      </div>
      <span className="report-export-status" role="status" aria-live="polite">{exportState}</span>
    </div>
  </div>;
}

export default InsightReport;
