import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { inventoryData } from "../data/sampleData";

function Inventory() {
  const lowStockCount = inventoryData.filter((item) => item.status === "Low").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Low Stock Alert Banner */}
      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">
          ⚠️ {lowStockCount} item(s) low stock mein hain — reorder level se neeche.
        </div>
      )}

      {/* Inventory Chart */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Stock by Item</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={inventoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="item" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="stock" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-sm p-5 overflow-x-auto">
        <h3 className="font-semibold text-slate-700 mb-4">Inventory Status</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-slate-500 border-b">
              <th className="py-2 px-3">Item</th>
              <th className="py-2 px-3">Stock</th>
              <th className="py-2 px-3">Reorder Level</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {inventoryData.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="py-2 px-3">{row.item}</td>
                <td className="py-2 px-3">{row.stock}</td>
                <td className="py-2 px-3">{row.reorderLevel}</td>
                <td className="py-2 px-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      row.status === "Low"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Inventory;