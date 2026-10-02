import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import DataImportModal from "./components/DataImportModal";
import DataSources from "./pages/DataSources";
import WorkspacePage from "./pages/WorkspacePage";
import DataHistory from "./pages/DataHistory";
import WorkspaceSetup from "./pages/WorkspaceSetup";
import PersonalizedDashboard from "./components/PersonalizedDashboard";
import { API_URL } from "./config";
import Onboarding from "./components/Onboarding";
import SettingsModal from "./components/SettingsModal";
import ChatPanel from "./components/ChatPanel";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("datawise-user") || "null");
  } catch {
    localStorage.removeItem("datawise-user");
    return null;
  }
}

function accountStorageKey(user, key) {
  const accountId = user?.id || user?.email;
  return accountId ? `${key}:${encodeURIComponent(accountId)}` : null;
}

function readWorkspaceState(user) {
  const workspacesKey = accountStorageKey(user, "datawise-workspaces");
  const activeKey = accountStorageKey(user, "datawise-active-workspace");
  const legacyKey = accountStorageKey(user, "datawise-workspace");
  if (!workspacesKey || !activeKey || !legacyKey) return { workspaces: [], activeId: "" };
  try {
    const saved = JSON.parse(localStorage.getItem(workspacesKey) || "null");
    const legacy = JSON.parse(localStorage.getItem(legacyKey) || "null");
    const workspaces = Array.isArray(saved) ? saved : legacy ? [{ ...legacy, id: "default" }] : [];
    const savedActiveId = localStorage.getItem(activeKey);
    const activeId = workspaces.some((item) => item.id === savedActiveId)
      ? savedActiveId
      : workspaces[0]?.id || "";
    return { workspaces, activeId };
  } catch {
    localStorage.removeItem(workspacesKey);
    localStorage.removeItem(activeKey);
    return { workspaces: [], activeId: "" };
  }
}

function saveWorkspaceState(user, workspaces, activeId) {
  const workspacesKey = accountStorageKey(user, "datawise-workspaces");
  const activeKey = accountStorageKey(user, "datawise-active-workspace");
  if (!workspacesKey || !activeKey) return;
  localStorage.setItem(workspacesKey, JSON.stringify(workspaces));
  localStorage.setItem(activeKey, activeId);
}

function createWorkspaceId() {
  return window.crypto?.randomUUID?.() || `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDashboardAnalysis(uploaded) {
  const totals = uploaded.analysis?.totals || {};
  const primaryTotal = Object.entries(totals).find(([key]) => /revenue|sales|income|amount/i.test(key));
  return {
    ...uploaded.analysis,
    rows: uploaded.rows || [],
    columns: uploaded.columns || [],
    totals,
    totalRevenue: primaryTotal ? Number(primaryTotal[1]) : 0,
    rowCount: uploaded.rowCount || uploaded.rows?.length || 0,
    fileId: uploaded.fileId,
    sourceId: uploaded.sourceId || null,
    updatedAt: uploaded.updatedAt || uploaded.lastSyncedAt || null,
    workspaceId: uploaded.workspaceId || "default",
    sourceName: uploaded.filename,
  };
}

const emailVerificationRequests = new Map();

function verifyEmailToken(token) {
  if (!emailVerificationRequests.has(token)) {
    const request = fetch(`${API_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Email confirmation failed.");
      return result;
    });
    emailVerificationRequests.set(token, request);
    request.then(
      () => emailVerificationRequests.delete(token),
      () => emailVerificationRequests.delete(token),
    );
  }
  return emailVerificationRequests.get(token);
}

function App() {
  const [user, setUser] = useState(readStoredUser);
  const [initialWorkspaceState] = useState(() => readWorkspaceState(readStoredUser()));
  const [workspaces, setWorkspaces] = useState(initialWorkspaceState.workspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialWorkspaceState.activeId);
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) || workspaces[0] || null;
  const activeWorkspaceIdForData = workspace?.id;
  const [token, setToken] = useState(() => localStorage.getItem("datawise-token"));
  const [sessionStatus, setSessionStatus] = useState(() => localStorage.getItem("datawise-token") ? "checking" : "ready");
  const [sessionError, setSessionError] = useState("");
  const [sessionRetry, setSessionRetry] = useState(0);
  const [verificationToken, setVerificationToken] = useState(() => new URLSearchParams(window.location.search).get("verify"));
  const [verificationStatus, setVerificationStatus] = useState(() => new URLSearchParams(window.location.search).has("verify") ? "checking" : "idle");
  const [verificationError, setVerificationError] = useState("");
  const [activePage, setActivePage] = useState("Dashboard");
  const [showImport, setShowImport] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("datawise-theme") === "dark");
  const [showWorkspaceSetup, setShowWorkspaceSetup] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (!token) {
      setSessionStatus("ready");
      return undefined;
    }

    let cancelled = false;
    setSessionStatus("checking");
    setSessionError("");
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.status === 401) {
          localStorage.removeItem("datawise-user");
          localStorage.removeItem("datawise-token");
          setUser(null);
          setToken(null);
          setWorkspaces([]);
          setActiveWorkspaceId("");
          setSessionStatus("ready");
          return;
        }
        if (!response.ok) {
          throw new Error(result.error || "Unable to verify your session.");
        }
        localStorage.setItem("datawise-user", JSON.stringify(result.user));
        setUser(result.user);
        const workspaceState = readWorkspaceState(result.user);
        setWorkspaces(workspaceState.workspaces);
        setActiveWorkspaceId(workspaceState.activeId);
        const onboardingKey = accountStorageKey(result.user, "datawise-onboarding-complete");
        setShowOnboarding(!localStorage.getItem(onboardingKey));
        setSessionStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setSessionError(error.message || "The server could not verify your session.");
        setSessionStatus("error");
      });

    return () => { cancelled = true; };
  }, [token, sessionRetry]);

  useEffect(() => {
    if (!token || !activeWorkspaceIdForData || analysis || sessionStatus !== "ready") return undefined;
    let cancelled = false;
    const restoreLatestUpload = async () => {
      try {
        const response = await fetch(`${API_URL}/api/files`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("Could not load saved datasets.");
        const files = (await response.json()).filter((file) => (file.workspaceId || "default") === activeWorkspaceIdForData);
        if (!files.length || cancelled) return;
        const latest = await fetch(`${API_URL}/api/files/${files[0]._id}`, { headers: { Authorization: `Bearer ${token}` } });
        const dataset = await latest.json();
        if (!latest.ok) throw new Error(dataset.error || "Could not restore the latest dataset.");
        if (!cancelled) setAnalysis(toDashboardAnalysis(dataset));
      } catch (error) {
        if (!cancelled) console.error("Could not restore the most recent upload:", error.message);
      }
    };
    restoreLatestUpload();
    return () => { cancelled = true; };
  }, [token, activeWorkspaceIdForData, analysis, sessionStatus]);

  useEffect(() => {
    if (!token || !activeWorkspaceIdForData || sessionStatus !== "ready") return undefined;
    let cancelled = false;
    const refreshConnectedDataset = async () => {
      try {
        const query = new URLSearchParams({ workspaceId: activeWorkspaceIdForData });
        const response = await fetch(`${API_URL}/api/sources?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Could not check live source status.");
        const sources = await response.json();
        if (!Array.isArray(sources)) throw new Error("The live source status response was invalid.");
        const source = sources.find((item) => item.enabled && item.fileId);
        if (!source || cancelled) return;
        if (analysis?.fileId && analysis.fileId !== source.fileId) return;
        if (
          analysis?.fileId === source.fileId && source.lastSyncedAt &&
          analysis.updatedAt && Date.parse(source.lastSyncedAt) <= Date.parse(analysis.updatedAt)
        ) return;
        const datasetResponse = await fetch(`${API_URL}/api/files/${source.fileId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const dataset = await datasetResponse.json().catch(() => ({}));
        if (!datasetResponse.ok) throw new Error(dataset.error || "Could not refresh the live dataset.");
        if (!cancelled) setAnalysis(toDashboardAnalysis(dataset));
      } catch (error) {
        if (!cancelled) console.error("Could not refresh live data:", error.message);
      }
    };
    void refreshConnectedDataset();
    const timer = window.setInterval(() => { void refreshConnectedDataset(); }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, activeWorkspaceIdForData, sessionStatus, analysis?.fileId, analysis?.updatedAt]);

  const handleAuthenticated = ({ user: nextUser, token: nextToken }) => {
    localStorage.setItem("datawise-user", JSON.stringify(nextUser));
    localStorage.setItem("datawise-token", nextToken);
    setUser(nextUser);
    setToken(nextToken);
    setSessionStatus("checking");
  };

  useEffect(() => {
    if (!verificationToken) return undefined;
    let cancelled = false;
    verifyEmailToken(verificationToken)
      .then((result) => {
        if (cancelled) return;
        window.history.replaceState({}, "", window.location.pathname);
        setVerificationToken(null);
        setVerificationStatus("idle");
        handleAuthenticated(result);
      })
      .catch((error) => {
        if (cancelled) return;
        window.history.replaceState({}, "", window.location.pathname);
        setVerificationError(error.message || "This confirmation link is invalid or expired.");
        setVerificationStatus("error");
      });
    return () => { cancelled = true; };
  }, [verificationToken]);

  const handleLogout = () => {
    if (token) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        if (!response.ok && response.status !== 401) {
          console.error("Could not revoke the server session.");
        }
      }).catch((error) => console.error("Could not reach the server to revoke the session:", error));
    }
    localStorage.removeItem("datawise-user");
    localStorage.removeItem("datawise-token");
    setUser(null);
    setToken(null);
    setAnalysis(null);
    setWorkspaces([]);
    setActiveWorkspaceId("");
    setShowOnboarding(false);
    setSessionStatus("ready");
  };

  const toggleTheme = () => setDarkMode((current) => { const next = !current; localStorage.setItem("datawise-theme", next ? "dark" : "light"); return next; });
  const completeWorkspaceSetup = (nextWorkspace) => {
    const isEditing = Boolean(editingWorkspaceId);
    const nextId = editingWorkspaceId || createWorkspaceId();
    const persistedWorkspace = { ...nextWorkspace, id: nextId };
    const nextWorkspaces = isEditing
      ? workspaces.map((item) => item.id === nextId ? persistedWorkspace : item)
      : [...workspaces, persistedWorkspace];
    setWorkspaces(nextWorkspaces);
    setActiveWorkspaceId(nextId);
    saveWorkspaceState(user, nextWorkspaces, nextId);
    setEditingWorkspaceId("");
    setShowWorkspaceSetup(false);
    setAnalysis(null);
    setActivePage("Dashboard");
  };
  const deleteWorkspace = () => {
    if (!workspace || !window.confirm(`Delete the "${workspace.category}" workspace settings? Its datasets, chats, and reports will be kept in Data history.`)) return;
    const nextWorkspaces = workspaces.filter((item) => item.id !== workspace.id);
    const nextWorkspace = nextWorkspaces[0] || null;
    setWorkspaces(nextWorkspaces);
    setActiveWorkspaceId(nextWorkspace?.id || "");
    saveWorkspaceState(user, nextWorkspaces, nextWorkspace?.id || "");
    const legacyKey = accountStorageKey(user, "datawise-workspace");
    if (legacyKey) localStorage.removeItem(legacyKey);
    setAnalysis(null);
    setActivePage("Dashboard");
    setShowChat(false);
  };
  const openTour = () => {
    const key = accountStorageKey(user, "datawise-onboarding-complete");
    if (key) localStorage.removeItem(key);
    setShowSettings(false);
    setShowOnboarding(true);
  };

  const handleAnalyze = async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspaceId", workspace.id);
      const response = await fetch(`${API_URL}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const uploaded = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(uploaded.error || "Could not save this dataset. Your dashboard was not changed.");
      setAnalysis(toDashboardAnalysis(uploaded));
      setShowImport(false);
    } catch (error) {
      throw error;
    }
  };

  const openHistoricalDataset = (dataset) => {
    const datasetWorkspaceId = dataset.workspaceId || "default";
    const targetWorkspace = datasetWorkspaceId === "default"
      ? workspace
      : workspaces.find((item) => item.id === datasetWorkspaceId);
    if (!targetWorkspace) return false;
    if (targetWorkspace.id !== workspace.id) {
      setActiveWorkspaceId(targetWorkspace.id);
      saveWorkspaceState(user, workspaces, targetWorkspace.id);
    }
    setAnalysis(toDashboardAnalysis(dataset));
    setActivePage("Dashboard");
    return true;
  };

  const openConnectedDataset = async (fileId) => {
    const response = await fetch(`${API_URL}/api/files/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dataset = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(dataset.error || "Could not open the connected dataset.");
    setAnalysis(toDashboardAnalysis(dataset));
    setActivePage("Dashboard");
  };

  const handleDeletedDatasets = (deletedIds) => {
    if (analysis?.fileId && deletedIds.includes(String(analysis.fileId))) setAnalysis(null);
  };

  if (verificationStatus === "checking") {
    return <main className="session-page"><section className="session-card" role="status"><div className="brand-mark">D</div><h1>Confirming your email</h1><p>Activating your verified Datawise account…</p></section></main>;
  }
  if (verificationStatus === "error") {
    return <main className="session-page"><section className="session-card"><div className="brand-mark">D</div><h1>Could not confirm your email</h1><p>{verificationError}</p><button className="login-button" onClick={() => { setVerificationError(""); setVerificationStatus("idle"); }}>Return to sign in</button></section></main>;
  }
  if (sessionStatus === "checking") {
    return <main className="session-page"><section className="session-card" role="status"><div className="brand-mark">D</div><h1>Checking your session</h1><p>Connecting securely to your Datawise workspace…</p></section></main>;
  }
  if (sessionStatus === "error") {
    return <main className="session-page"><section className="session-card"><div className="brand-mark">D</div><h1>Can’t verify your session</h1><p>{sessionError}</p><div className="session-actions"><button className="login-button" onClick={() => setSessionRetry((attempt) => attempt + 1)}>Try again</button><button className="session-signout" onClick={handleLogout}>Sign out</button></div></section></main>;
  }
  if (!user || !token) return <Login onAuthenticated={handleAuthenticated} />;
  if (!workspace || showWorkspaceSetup) {
    const initialWorkspace = workspaces.find((item) => item.id === editingWorkspaceId);
    return <WorkspaceSetup
      key={editingWorkspaceId || "new-workspace"}
      initialWorkspace={initialWorkspace}
      onCancel={() => { setShowWorkspaceSetup(false); setEditingWorkspaceId(""); }}
      onComplete={completeWorkspaceSetup}
    />;
  }

  return (
    <div className={`app-shell ${darkMode ? "dark-mode" : ""}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        workspace={workspace}
        workspaces={workspaces}
        onSwitchWorkspace={(id) => {
          setActiveWorkspaceId(id);
          saveWorkspaceState(user, workspaces, id);
          setAnalysis(null);
          setActivePage("Dashboard");
          setShowChat(false);
        }}
        onCreateWorkspace={() => { setEditingWorkspaceId(""); setShowWorkspaceSetup(true); }}
        onEditWorkspace={() => { setEditingWorkspaceId(workspace.id); setShowWorkspaceSetup(true); }}
        onDeleteWorkspace={deleteWorkspace}
      />
      <Navbar activePage={activePage} user={user} onAddData={() => setShowImport(true)} onLogout={handleLogout} darkMode={darkMode} onToggleTheme={toggleTheme} onOpenSettings={() => setShowSettings(true)} onOpenAI={() => setShowChat(true)} />

      <main className="main-content">
        {activePage === "Data sources" && <DataSources
          token={token}
          workspaceId={workspace.id}
          onImport={() => setShowImport(true)}
          onOpenDashboard={() => setActivePage("Dashboard")}
          onSourceSynced={openConnectedDataset}
        />}
        {activePage === "Data history" && <DataHistory token={token} workspaceId={workspace.id} workspaces={workspaces} onAddData={() => setShowImport(true)} onOpenDataset={openHistoricalDataset} onDeletedDatasets={handleDeletedDatasets} />}
        {activePage === "Dashboard" && (analysis ? <Dashboard analysis={analysis} workspace={workspace} onAddData={() => setShowImport(true)} user={user} onOpenAI={() => setShowChat(true)} /> : <PersonalizedDashboard workspace={workspace} onAddData={() => setShowImport(true)} onCustomize={() => { setEditingWorkspaceId(workspace.id); setShowWorkspaceSetup(true); }} />)}
        {workspace.metrics.includes(activePage) && <Dashboard analysis={analysis} workspace={{ ...workspace, metrics: [activePage] }} onAddData={() => setShowImport(true)} user={user} onOpenAI={() => setShowChat(true)} />}
        {activePage === "Reports" && <WorkspacePage page={activePage} onAddData={() => setShowImport(true)} />}
      </main>
      {showChat && <div className="chat-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowChat(false); }}><ChatPanel analysis={analysis} workspace={workspace} user={user} token={token} onClose={() => setShowChat(false)} /></div>}
      {showImport && <DataImportModal onClose={() => setShowImport(false)} onAnalyze={handleAnalyze} />}
      {showOnboarding && <Onboarding storageKey={accountStorageKey(user, "datawise-onboarding-complete")} onFinish={() => setShowOnboarding(false)} onImport={() => setShowImport(true)} />}
      {showSettings && <SettingsModal user={user} darkMode={darkMode} onToggleTheme={toggleTheme} onClose={() => setShowSettings(false)} onLogout={handleLogout} onTour={openTour} />}
    </div>
  );
}

export default App;