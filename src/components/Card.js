import React from "react";

function Card({ title, value, change, positive }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-2">
      <span className="text-sm text-slate-500">{title}</span>
      <span className="text-2xl font-bold text-slate-800">{value}</span>
      <span
        className={`text-xs font-medium ${
          positive ? "text-green-600" : "text-red-600"
        }`}
      >
        {change} vs last month
      </span>
    </div>
  );
}

export default Card;