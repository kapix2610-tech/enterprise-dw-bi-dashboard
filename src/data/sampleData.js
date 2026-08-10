// Summary cards ke liye data
export const summaryCards = [
  { title: "Total Revenue", value: "₹12,45,000", change: "+8.2%" },
  { title: "Inventory Value", value: "₹6,80,500", change: "-2.1%" },
  { title: "Cash Flow", value: "₹3,20,000", change: "+5.4%" },
  { title: "Active Customers", value: "482", change: "+12" },
];

// Revenue trend chart ke liye data (line chart)
export const revenueTrend = [
  { month: "Jan", revenue: 85000 },
  { month: "Feb", revenue: 92000 },
  { month: "Mar", revenue: 78000 },
  { month: "Apr", revenue: 105000 },
  { month: "May", revenue: 98000 },
  { month: "Jun", revenue: 124500 },
];

// Sales table data
export const salesData = [
  { id: 1, product: "Product A", units: 120, revenue: 60000, region: "North" },
  { id: 2, product: "Product B", units: 85, revenue: 42500, region: "South" },
  { id: 3, product: "Product C", units: 200, revenue: 100000, region: "East" },
  { id: 4, product: "Product D", units: 45, revenue: 22500, region: "West" },
  { id: 5, product: "Product E", units: 160, revenue: 80000, region: "North" },
];

// Inventory table data
export const inventoryData = [
  { id: 1, item: "Raw Material X", stock: 12, reorderLevel: 20, status: "Low" },
  { id: 2, item: "Raw Material Y", stock: 150, reorderLevel: 30, status: "OK" },
  { id: 3, item: "Packaging Box", stock: 8, reorderLevel: 25, status: "Low" },
  { id: 4, item: "Finished Good A", stock: 200, reorderLevel: 50, status: "OK" },
  { id: 5, item: "Finished Good B", stock: 15, reorderLevel: 20, status: "Low" },
];

// Cash flow chart data (bar chart)
export const cashFlowData = [
  { month: "Jan", inflow: 90000, outflow: 65000 },
  { month: "Feb", inflow: 95000, outflow: 70000 },
  { month: "Mar", inflow: 80000, outflow: 72000 },
  { month: "Apr", inflow: 110000, outflow: 68000 },
  { month: "May", inflow: 98000, outflow: 75000 },
  { month: "Jun", inflow: 125000, outflow: 80000 },
];

// Customer data
export const customerData = [
  { id: 1, name: "Sharma Traders", segment: "Retail", totalSpend: 245000 },
  { id: 2, name: "Patel Industries", segment: "Wholesale", totalSpend: 580000 },
  { id: 3, name: "Verma Enterprises", segment: "Retail", totalSpend: 132000 },
  { id: 4, name: "Kumar & Sons", segment: "Wholesale", totalSpend: 412000 },
];