import React from "react";

function Navbar({ activePage }) {
  return (
    <div className="h-16 bg-white shadow-sm flex items-center justify-between px-6 fixed top-0 left-56 right-0 z-10">
      <h1 className="text-xl font-semibold text-slate-800">{activePage}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">Welcome, Admin</span>
        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
          A
        </div>
      </div>
    </div>
  );
}

export default Navbar;