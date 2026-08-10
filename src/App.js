import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Inventory from "./pages/Inventory";
import Finance from "./pages/Finance";
import Customers from "./pages/Customers";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  return (
    <div className="bg-slate-100 min-h-screen">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <Navbar activePage={activePage} />

      <div className="ml-56 pt-16 p-6">
       {activePage === "Dashboard" && <Dashboard />}
        {activePage === "Sales" && <Sales />}
        {activePage === "Inventory" && <Inventory />}
        {activePage === "Finance" && <Finance />}
        {activePage === "Customers" && <Customers />}
      </div>
    </div>
  );
}

export default App;