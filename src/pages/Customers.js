import React from "react";
import { customerData } from "../data/sampleData";

function Customers() {
  return (
    <div className="flex flex-col gap-6">
      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-sm p-5 overflow-x-auto">
        <h3 className="font-semibold text-slate-700 mb-4">Customer List</h3>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-slate-500 border-b">
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Segment</th>
              <th className="py-2 px-3">Total Orders</th>
              <th className="py-2 px-3">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {customerData.map((row) => (
              <tr key={row.id} className="border-b hover:bg-slate-50">
                <td className="py-2 px-3 font-medium">{row.name}</td>
                <td className="py-2 px-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      row.segment === "Wholesale"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {row.segment}
                  </span>
                </td>
                <td className="py-2 px-3">{row.totalOrders}</td>
                <td className="py-2 px-3">₹{row.totalSpend.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Customers;