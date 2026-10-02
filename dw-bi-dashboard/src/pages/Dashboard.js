import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import Modal from "../components/Modal";
import { revenueTrend, inventoryData, salesData } from "../data/sampleData";

const regionalData = [{ region: "North", sales: 86, color: "#2e62e8" }, { region: "West", sales: 72, color: "#5e88ee" }, { region: "South", sales: 58, color: "#8faaf3" }, { region: "East", sales: 46, color: "#c4d2f8" }];
const activity = [{ title: "New order received", detail: "Order #DW-2841 · Sharma Traders", time: "12 min ago", color: "blue" }, { title: "Inventory threshold crossed", detail: "Raw Material X needs attention", time: "48 min ago", color: "orange" }, { title: "Monthly report exported", detail: "Finance report · August 2026", time: "2 hrs ago", color: "green" }];
const formatCurrency = (value) => `₹${(Number(value) || 0).toLocaleString()}`;

function EmptyDashboard({ onAddData }) {
  return <div className="dashboard-empty"><div className="empty-hero-icon">✦</div><span className="eyebrow">YOUR PRIVATE WORKSPACE</span><h1>Your dashboard is ready for data.</h1><p>Upload a CSV or Excel file and Datawise will build your KPIs, trends, alerts and AI insights here.</p><div className="empty-actions"><button className="primary-button" onClick={onAddData}>＋ Upload your first dataset</button><button className="date-control" onClick={onAddData}>View supported formats →</button></div><div className="empty-benefits"><div><span>01</span><strong>Connect</strong><small>Upload your business data</small></div><div><span>02</span><strong>Analyze</strong><small>AI finds the important signals</small></div><div><span>03</span><strong>Decide</strong><small>Act from one clear view</small></div></div></div>;
}

function AdaptiveDashboard({ analysis, workspace, onAddData, user, onOpenAI }) {
  const rows = Array.isArray(analysis?.rows) ? analysis.rows : [];
  const columns = analysis?.columns || Object.keys(rows[0] || {});
  const totals = analysis?.totals || {};
  const category = workspace?.category || "Business";
  const metricNames = workspace?.metrics?.length ? workspace.metrics : [];
  const metricPatterns = [
    { matches: /revenue|income/i, icon: "↗", field: /revenue|sales|income|amount/i },
    { matches: /customer|user/i, icon: "◯", field: /customer|user|client|email/i },
    { matches: /operation|project|task/i, icon: "⌁", field: /operation|project|task|order|record/i },
    { matches: /inventory|asset/i, icon: "□", field: /inventory|asset|stock|quantity|unit/i },
    { matches: /marketing/i, icon: "◎", field: /marketing|campaign|click|conversion|lead|impression/i },
    { matches: /quality|compliance/i, icon: "✓", field: /quality|compliance|status|validated/i },
    { matches: /team performance/i, icon: "✦", field: /performance|productivity|score|team/i },
  ];
  const cards = metricNames.map((metric, index) => {
    const metricDefinition = metricPatterns.find((item) => item.matches.test(metric));
    const matchingTotal = Object.entries(totals).find(([key]) => metricDefinition?.field.test(key));
    const matchingColumn = columns.find((column) => metricDefinition?.field.test(column));
    let value = "No matching data";
    let detail = "Upload data with a matching field to populate this metric.";
    if (matchingTotal) {
      value = Number(matchingTotal[1]).toLocaleString();
      detail = `Total ${matchingTotal[0]} from ${rows.length.toLocaleString()} records`;
    } else if (matchingColumn && /customer|user/i.test(metric)) {
      const unique = new Set(rows.map((row) => String(row[matchingColumn] ?? "").trim()).filter(Boolean));
      value = unique.size.toLocaleString();
      detail = `Unique ${matchingColumn} values`;
    } else if (rows.length) {
      value = rows.length.toLocaleString();
      detail = matchingColumn ? `${matchingColumn} values across uploaded records` : "Uploaded records";
    }
    return { metric, icon: metricDefinition?.icon || "•", value, detail, tone: index % 4 };
  });
  const selectedNumericEntries = metricNames.flatMap((metric) => {
    const definition = metricPatterns.find((item) => item.matches.test(metric));
    const matchingEntry = Object.entries(totals).find(([field, value]) => (
      definition?.field.test(field) && Number.isFinite(Number(value))
    ));
    return matchingEntry ? [matchingEntry] : [];
  });
  const largestSelectedTotal = Math.max(1, ...selectedNumericEntries.map(([, value]) => Number(value) || 0));

  return (
    <div className="adaptive-dashboard">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{category.toUpperCase()} INTELLIGENCE</p>
          <h1>{user?.name ? `Welcome, ${user.name.split(/\s+/)[0]}` : `Your ${category} dashboard`} <span>✦</span></h1>
          <p className="page-subtitle">Showing only the metrics selected for this workspace: {metricNames.join(" · ")}.</p>
        </div>
        <div className="heading-actions">
          <button className="ai-launch-button" onClick={onOpenAI}>✦ <span>Ask AI</span></button>
          <button className="primary-button" onClick={onAddData}>＋ Add data</button>
        </div>
      </section>
      <div className="adaptive-kpi-grid">
        {cards.map((card) => (
          <div className={`adaptive-kpi tone-${card.tone}`} key={card.metric}>
            <span>{card.icon} {card.metric}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </div>
        ))}
      </div>
      <section className="adaptive-main-grid">
        <div className="panel adaptive-panel">
          <div className="panel-heading">
            <div><h2>Dataset overview</h2><p>{analysis.sourceName || "Saved dataset"} · {rows.length.toLocaleString()} records</p></div>
            <span className="report-badge">{analysis.sourceId ? "↻ Live API" : "✦ Ready"}</span>
          </div>
          <div className="adaptive-insight">
            <span className="adaptive-icon">✦</span>
            <div>
              <strong>Data linked to your selected metrics</strong>
              <p>{columns.length.toLocaleString()} fields available. Dashboard cards use uploaded values; missing matching fields are clearly marked.</p>
            </div>
          </div>
          {selectedNumericEntries.length > 0 && (
            <div className="adaptive-bars">
              {selectedNumericEntries.map(([field, value]) => (
                <div key={field}><div><span>{field}</span><strong>{Number(value).toLocaleString()}</strong></div><i style={{ width: `${Math.max(8, Math.min(100, (Number(value) || 0) / largestSelectedTotal * 100))}%` }}></i></div>
              ))}
            </div>
          )}
        </div>
        <div className="panel adaptive-panel">
          <div className="panel-heading"><div><h2>Your dashboard focus</h2><p>Configured during workspace setup</p></div></div>
          <div className="adaptive-question-list">
            {metricNames.map((metric) => <div className="adaptive-focus-item" key={metric}><span>✓</span>{metric}</div>)}
            {workspace?.goal && <p className="adaptive-focus-goal">{workspace.goal}</p>}
          </div>
        </div>
      </section>
      <div className="adaptive-empty-note"><span>{analysis.sourceId ? "↻" : "✦"}</span><div><strong>{analysis.sourceId ? "Live data refresh is enabled" : "Data stays in your private workspace"}</strong><p>{analysis.sourceId ? `API snapshot refreshed ${analysis.updatedAt ? new Date(analysis.updatedAt).toLocaleString() : "recently"}. New data is fetched every 5 minutes.` : `Current source: ${analysis.sourceName || "uploaded dataset"}. Open Data history to inspect or delete saved uploads.`}</p></div></div>
    </div>
  );
}

function Dashboard({ analysis, workspace, onAddData, user, onOpenAI }) {
  const [selectedMonth, setSelectedMonth] = useState(null);

  if (!analysis) return <EmptyDashboard onAddData={onAddData} />;
  if (workspace?.metrics?.length) return <AdaptiveDashboard analysis={analysis} workspace={workspace} onAddData={onAddData} user={user} onOpenAI={onOpenAI} />;

  const chartData = analysis?.byDate?.length ? analysis.byDate : revenueTrend;
  const chartRows = analysis?.rows?.length ? analysis.rows : salesData;
  const totalRevenue = Number(analysis?.totalRevenue) || 1245000;
  const topProduct = analysis?.topProduct?.product || "Product A";
  const regions = analysis?.byRegion?.length ? analysis.byRegion.map((item, index) => ({ ...item, sales: totalRevenue ? Math.round((item.revenue / totalRevenue) * 100) : 0, color: ["#2e62e8", "#5e88ee", "#8faaf3", "#c4d2f8"][index % 4] })) : regionalData;

  const handleBarClick = (data) => {
    if (data && data.activeLabel) {
      setSelectedMonth(data.activeLabel);
    }
  };

  const closeModal = () => setSelectedMonth(null);
  const monthDetail = revenueTrend.find((m) => m.month === selectedMonth);

  return (
    <div className="dashboard-page">
      <section className="page-heading"><div><p className="eyebrow">MONDAY, 21 SEPTEMBER 2026</p><h1>Good morning, Admin <span>✦</span></h1><p className="page-subtitle">{analysis ? `Analysis ready from ${analysis.sourceName} · ${analysis.rowCount} rows analyzed.` : "Here&apos;s what&apos;s happening across your business today."}</p></div><div className="heading-actions"><button className="ai-launch-button" onClick={onOpenAI}>✦ <span>Ask AI</span></button><button className="date-control">◷ <span>Last 6 months</span>⌄</button><button className="primary-button" onClick={onAddData}>＋ <span>New report</span></button></div></section>
      <section className="kpi-grid">
        <div className="kpi-card accent-blue"><div className="kpi-top"><span>Total revenue</span><span className="kpi-icon">↗</span></div><strong>{formatCurrency(totalRevenue)}</strong><div className="kpi-bottom"><span className="positive">✦ analyzed</span><span>{analysis ? "from your data" : "vs last month"}</span><span className="sparkline blue">▁▃▂▅▆▇</span></div></div>
        <div className="kpi-card accent-purple"><div className="kpi-top"><span>Inventory value</span><span className="kpi-icon">□</span></div><strong>₹6,80,500</strong><div className="kpi-bottom"><span className="negative">↓ 2.1%</span><span>vs last month</span><span className="sparkline purple">▆▅▅▄▃▂</span></div></div>
        <div className="kpi-card accent-orange"><div className="kpi-top"><span>Net cash flow</span><span className="kpi-icon">₹</span></div><strong>₹3,20,000</strong><div className="kpi-bottom"><span className="positive">↑ 5.4%</span><span>vs last month</span><span className="sparkline orange">▂▃▂▄▅▆</span></div></div>
        <div className="kpi-card accent-green"><div className="kpi-top"><span>Top performer</span><span className="kpi-icon">◯</span></div><strong className="kpi-product">{topProduct}</strong><div className="kpi-bottom"><span className="positive">↑ insight</span><span>highest revenue</span><span className="sparkline green">▂▃▄▃▆▇</span></div></div>
      </section>

      {/* Charts */}
      <section className="analytics-grid">
        <div className="panel revenue-panel"><div className="panel-heading"><div><h2>Revenue overview</h2><p>Track your revenue performance over time</p></div><div className="legend"><span><i className="legend-dot blue-dot"></i>Revenue</span><span><i className="legend-dot light-dot"></i>Target</span></div></div><div className="revenue-total"><strong>₹{totalRevenue.toLocaleString()}</strong><span className="positive">✦ AI analyzed</span><small>{analysis ? "Based on your uploaded dataset" : "Compared to ₹11,50,000 last period"}</small></div><ResponsiveContainer width="100%" height={235}><AreaChart data={chartData} onClick={handleBarClick} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b6fe8" stopOpacity={0.22}/><stop offset="100%" stopColor="#3b6fe8" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5"/><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8d96a8", fontSize: 12 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#8d96a8", fontSize: 11 }} tickFormatter={(value) => `₹${value / 1000}k`}/><Tooltip contentStyle={{ border: "0", borderRadius: "8px", boxShadow: "0 8px 24px rgba(20,35,70,.12)" }}/><Area type="monotone" dataKey="revenue" stroke="#2e62e8" strokeWidth={3} fill="url(#revenueFill)" activeDot={{ r: 5, fill: "#fff", stroke: "#2e62e8", strokeWidth: 3 }}/></AreaChart></ResponsiveContainer>
        </div>

        <div className="panel regional-panel"><div className="panel-heading"><div><h2>Sales by region</h2><p>Current month performance</p></div><button className="more-button">•••</button></div><div className="region-total"><strong>{formatCurrency(totalRevenue)}</strong><span className="positive">✦ auto grouped</span></div><div className="region-bars">{regions.map((item) => <div className="region-row" key={item.region}><div className="region-label"><span>{item.region}</span><strong>{formatCurrency(item.revenue || (Number(item.sales) || 0) * 1000)}</strong></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Number(item.sales) || 0}%`, background: item.color }}></div></div></div>)}</div><div className="region-foot"><span>Highest performing</span><strong>{regions[0]?.region || "North"} region <span>↗</span></strong></div></div>
        </section>

      <section className="lower-grid"><div className="panel inventory-panel"><div className="panel-heading"><div><h2>Inventory health</h2><p>Stock levels across categories</p></div><button className="text-button">View inventory <span>→</span></button></div><div className="inventory-content"><ResponsiveContainer width="58%" height={165}><BarChart data={inventoryData} margin={{ left: -25, right: 8, bottom: 0 }}><CartesianGrid vertical={false} stroke="#edf0f5"/><XAxis dataKey="item" hide/><YAxis axisLine={false} tickLine={false} tick={{ fill: "#8d96a8", fontSize: 11 }}/><Tooltip/><Bar dataKey="stock" fill="#87a3ef" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer><div className="health-stats"><div><span className="health-dot green"></span><div><strong>72%</strong><small>Healthy stock</small></div></div><div><span className="health-dot orange"></span><div><strong>18%</strong><small>Low stock</small></div></div><div><span className="health-dot red"></span><div><strong>10%</strong><small>Out of stock</small></div></div></div></div></div><div className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from your workspace</p></div><button className="more-button">•••</button></div><div className="activity-list">{activity.map((item) => <div className="activity-item" key={item.title}><span className={`activity-icon ${item.color}`}>{item.color === "blue" ? "↗" : item.color === "orange" ? "!" : "✓"}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{item.time}</time></div>)}</div><button className="view-all">View all activity <span>→</span></button></div></section>

      {/* Drill-down Modal */}
      <Modal isOpen={!!selectedMonth} onClose={closeModal} title={`${selectedMonth} — Details`}>
        {monthDetail && (
          <p className="text-slate-600 mb-3">
            Total Revenue: <span className="font-semibold">₹{monthDetail.revenue.toLocaleString()}</span>
          </p>
        )}
        <p className="text-sm text-slate-500 mb-2">Related transactions:</p>
        <div className="max-h-48 overflow-y-auto">
          {chartRows.map((s) => (
            <div key={s.id} className="flex justify-between text-sm py-1 border-b">
              <span>{s.product}</span>
              <span>{formatCurrency(s.revenue)}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default Dashboard;