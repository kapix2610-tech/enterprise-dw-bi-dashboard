const sampleRows = [
  { date: "2026-08-01", product: "Product A", region: "North", revenue: 60000, units: 120 },
  { date: "2026-08-02", product: "Product B", region: "South", revenue: 42500, units: 85 },
  { date: "2026-08-03", product: "Product C", region: "East", revenue: 100000, units: 200 },
  { date: "2026-08-04", product: "Product D", region: "West", revenue: 22500, units: 45 },
];

function parseCsv(value) {
  const lines = value.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("Add a header row and at least one data row.");
  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => line.split(",").reduce((row, cell, index) => ({ ...row, [headers[index]]: cell.trim() }), {}));
}

function normalizeRows(rawRows) {
  const rows = rawRows.map((row, index) => ({
    id: index + 1,
    date: row.date || row.month || `Row ${index + 1}`,
    product: row.product || row.item || row.name || "Uncategorised",
    region: row.region || row.category || "All regions",
    revenue: Number(String(row.revenue || row.sales || row.amount || 0).replace(/[^\d.-]/g, "")) || 0,
    units: Number(String(row.units || row.quantity || 0).replace(/[^\d.-]/g, "")) || 0,
  }));
  if (!rows.some((row) => row.revenue > 0 || row.units > 0)) throw new Error("We could not find numeric revenue, sales, amount, units, or quantity columns.");
  return rows;
}

export function analyzeData(value) {
  let parsed;
  try { parsed = value.trim().startsWith("[") ? JSON.parse(value) : parseCsv(value); } catch (error) { throw new Error("We could not read this dataset. Check that it is valid CSV or JSON."); }
  const rows = normalizeRows(parsed);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
  const byRegion = Object.values(rows.reduce((result, row) => { result[row.region] = result[row.region] || { region: row.region, revenue: 0 }; result[row.region].revenue += row.revenue; return result; }, {})).sort((a, b) => b.revenue - a.revenue);
  const byDate = Object.values(rows.reduce((result, row) => { result[row.date] = result[row.date] || { month: row.date, revenue: 0 }; result[row.date].revenue += row.revenue; return result; }, {}));
  const topProduct = [...rows].sort((a, b) => b.revenue - a.revenue)[0];
  return { rows, totalRevenue, totalUnits, byRegion, byDate, topProduct, rowCount: rows.length };
}

export { sampleRows };
