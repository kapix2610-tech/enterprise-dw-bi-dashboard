import React from "react";

function Sidebar({ activePage, setActivePage, workspace, workspaces, onSwitchWorkspace, onCreateWorkspace, onEditWorkspace, onDeleteWorkspace }) {
  const metricIcons = [
    ["revenue|income", "₹"],
    ["customer|user", "◯"],
    ["operation|project|task", "⌁"],
    ["inventory|asset", "□"],
    ["marketing", "◎"],
    ["quality|compliance", "✓"],
    ["team performance", "✦"],
  ];
  const menuItems = [
    { name: "Data sources", icon: "＋" },
    { name: "Data history", icon: "◷" },
    { name: "Dashboard", icon: "▦" },
    ...(workspace?.metrics || []).map((metric) => ({
      name: metric,
      icon: metricIcons.find(([pattern]) => new RegExp(pattern, "i").test(metric))?.[1] || "•",
    })),
    { name: "Reports", icon: "▤" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <div className="brand-mark">D</div>
        <div><h2>Datawise</h2><p>Business intelligence</p></div>
      </div>
      <div className="nav-label">Workspace</div>
      <div className="workspace-switcher">
        <select
          aria-label="Active workspace"
          value={workspace?.id || ""}
          onChange={(event) => onSwitchWorkspace(event.target.value)}
        >
          {workspaces.map((item) => <option value={item.id} key={item.id}>{item.category}</option>)}
        </select>
        <div>
          <button type="button" onClick={onCreateWorkspace}>＋ New</button>
          <button type="button" onClick={onEditWorkspace}>Edit</button>
          <button type="button" onClick={onDeleteWorkspace} aria-label={`Delete ${workspace?.category} workspace`}>Delete</button>
        </div>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.name}
            onClick={() => setActivePage(item.name)}
            className={`nav-item ${
              activePage === item.name
                ? "active"
                : ""
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="status-dot"></div><span>All systems operational</span>
      </div>
    </aside>
  );
}

export default Sidebar;