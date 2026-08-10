import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { salesData, revenueTrend } from "../data/sampleData";

function Sales() {
  return (
    <div className="flex flex-col gap-6">
      {/* Sales Chart */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Monthly Sales Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={revenueTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl shadow-sm p-5 overflow-x-auto">
        <h3 className="font-semibold text-slate-700 mb-4">Recent Sales</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-slate-500 border-b">
              <th className="py-2 px-3">Product</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3">Units</th>
              <th className="py-2 px-3">Revenue</th>
              <th className="py-2 px-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {salesData.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="py-2 px-3">{row.product}</td>
                <td className="py-2 px-3">{row.category}</td>
                <td className="py-2 px-3">{row.units}</td>
                <td className="py-2 px-3">₹{row.revenue.toLocaleString()}</td>
                <td className="py-2 px-3">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Sales;