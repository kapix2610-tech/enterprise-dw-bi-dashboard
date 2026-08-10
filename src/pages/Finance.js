import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { cashFlowData } from "../data/sampleData";

function Finance() {
  const totalInflow = cashFlowData.reduce((sum, item) => sum + item.inflow, 0);
  const totalOutflow = cashFlowData.reduce((sum, item) => sum + item.outflow, 0);
  const netCashFlow = totalInflow - totalOutflow;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <span className="text-sm text-slate-500">Total Inflow</span>
          <p className="text-2xl font-bold text-green-600">₹{totalInflow.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <span className="text-sm text-slate-500">Total Outflow</span>
          <p className="text-2xl font-bold text-red-600">₹{totalOutflow.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <span className="text-sm text-slate-500">Net Cash Flow</span>
          <p className="text-2xl font-bold text-blue-600">₹{netCashFlow.toLocaleString()}</p>
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Inflow vs Outflow (Monthly)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={cashFlowData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="inflow" fill="#16a34a" name="Inflow" />
            <Bar dataKey="outflow" fill="#dc2626" name="Outflow" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Finance;