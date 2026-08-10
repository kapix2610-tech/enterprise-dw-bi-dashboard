import React, { useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../components/Card";
import Modal from "../components/Modal";
import { summaryCards, revenueTrend, inventoryData, salesData } from "../data/sampleData";

function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(null);

  const handleBarClick = (data) => {
    if (data && data.activeLabel) {
      setSelectedMonth(data.activeLabel);
    }
  };

  const closeModal = () => setSelectedMonth(null);

  // Selected month ka detail data nikaalo
  const monthDetail = revenueTrend.find((m) => m.month === selectedMonth);
  const relatedSales = salesData.filter((s) => s.date && s.date.includes("2026-08"));

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.title} {...card} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-slate-700 mb-1">Revenue Trend</h3>
          <p className="text-xs text-slate-400 mb-4">Kisi bhi point pe click karo detail dekhne ke liye</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={revenueTrend} onClick={handleBarClick}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                strokeWidth={2}
                activeDot={{ r: 6, cursor: "pointer" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Inventory by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={inventoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="stock" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Drill-down Modal */}
      <Modal isOpen={!!selectedMonth} onClose={closeModal} title={`${selectedMonth} — Details`}>
        {monthDetail && (
          <p className="text-slate-600 mb-3">
            Total Revenue: <span className="font-semibold">₹{monthDetail.revenue.toLocaleString()}</span>
          </p>
        )}
        <p className="text-sm text-slate-500 mb-2">Related transactions:</p>
        <div className="max-h-48 overflow-y-auto">
          {relatedSales.map((s) => (
            <div key={s.id} className="flex justify-between text-sm py-1 border-b">
              <span>{s.product}</span>
              <span>₹{s.revenue.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default Dashboard;