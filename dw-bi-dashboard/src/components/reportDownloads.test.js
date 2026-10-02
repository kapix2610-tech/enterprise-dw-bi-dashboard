import { getReportChartMetrics } from "./reportDownloads";

test("charts only selected workspace metrics when dataset totals are available", () => {
  const metrics = getReportChartMetrics({
    totals: { income: 12500, users: 24, stock_quantity: 91 },
    rows: [],
  }, ["Revenue / income", "Customers / users"]);

  expect(metrics).toEqual([
    { label: "income", value: 12500 },
    { label: "users", value: 24 },
  ]);
});

test("derives a user count from distinct dataset values when no user total exists", () => {
  const metrics = getReportChartMetrics({
    totals: { revenue: 250 },
    columns: ["email"],
    rows: [{ email: "a@example.com" }, { email: "a@example.com" }, { email: "b@example.com" }],
  }, ["Customers / users"]);

  expect(metrics).toEqual([{ label: "Customers / users (unique)", value: 2 }]);
});
