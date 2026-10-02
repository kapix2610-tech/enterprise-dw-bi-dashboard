import React from "react";

function Navbar({ activePage, user, onAddData, onLogout, darkMode, onToggleTheme, onOpenSettings, onOpenAI }) {
  return (
    <header className="topbar">
      <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activePage}</strong></div>
      <div className="topbar-actions"><button className="topbar-add" onClick={onAddData}>＋ <span>Add data</span></button><button className="ai-nav-button" onClick={onOpenAI}>✦ <span>AI assistant</span></button><button className="icon-button" aria-label="Toggle dark mode" onClick={onToggleTheme}>{darkMode ? "☼" : "☾"}</button><button className="icon-button" aria-label="Search" onClick={onAddData}>⌕</button><button className="icon-button notification" aria-label="Notifications" onClick={onOpenSettings}>♢<i></i></button><button className="icon-button" aria-label="Settings" onClick={onOpenSettings}>⚙</button><button className="profile" onClick={onLogout}><div className="avatar">{user?.name?.slice(0, 2).toUpperCase() || "AR"}</div><div className="profile-copy"><strong>{user?.name || "Workspace owner"}</strong><span>Sign out</span></div><span className="chevron">⌄</span></button></div>
    </header>
  );
}

export default Navbar;