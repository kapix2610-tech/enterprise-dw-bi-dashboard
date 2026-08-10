import React from "react";

function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    { name: "Dashboard", icon: "📊" },
    { name: "Sales", icon: "💰" },
    { name: "Inventory", icon: "📦" },
    { name: "Finance", icon: "💳" },
    { name: "Customers", icon: "👥" },
  ];

  return (
    <div className="h-screen w-56 bg-slate-900 text-white fixed left-0 top-0 flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <h2 className="text-lg font-bold">Enterprise DW & BI</h2>
        <p className="text-xs text-slate-400">Dashboard Platform</p>
      </div>
      <nav className="flex-1 mt-4">
        {menuItems.map((item) => (
          <button
            key={item.name}
            onClick={() => setActivePage(item.name)}
            className={`w-full text-left px-5 py-3 flex items-center gap-3 text-sm transition ${
              activePage === item.name
                ? "bg-slate-700 border-l-4 border-blue-500"
                : "hover:bg-slate-800"
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        v1.0 · Team C1
      </div>
    </div>
  );
}

export default Sidebar;