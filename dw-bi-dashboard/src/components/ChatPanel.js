import { useEffect, useState } from "react";
import { API_URL } from "../config";
import InsightReport from "./InsightReport";

function ChatPanel({ analysis, workspace, user, token, onClose }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (analysis?.fileId) query.set("fileId", analysis.fileId);
    const historyUrl = `${API_URL}/api/chat/history${query.toString() ? `?${query}` : ""}`;

    setMessages([]);
    setHistoryLoading(true);
    fetch(historyUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result = await response.json().catch(() => []);
        if (!response.ok) throw new Error(result.error || "Could not load chat history.");
        if (!cancelled && Array.isArray(result)) {
          setMessages(result.filter((item) => ["user", "assistant"].includes(item.role) && item.content)
            .map(({ role, content }) => ({ role, content })));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => { cancelled = true; };
  }, [analysis?.fileId, token]);

  const send = async (preset) => {
    const prompt = (preset || question).trim();
    if (!prompt || busy || historyLoading) return;
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: prompt, fileId: analysis?.fileId, data: analysis }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "I could not answer that yet.");
      setMessages((current) => [...current, { role: "assistant", content: result.answer || result.error || "I could not answer that yet." }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error.message || "Backend is offline. Start the backend server on port 5000 and try again." }]);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (type) => {
    if (!analysis || busy || historyLoading) return;
    setBusy(true);
    try {
      const endpoint = type === "report" ? "/api/report" : "/api/anomalies";
      const requestBody = type === "report"
        ? { data: analysis, fileId: analysis.fileId }
        : { data: analysis };
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not run this analysis.");
      setMessages((current) => [...current, {
        role: "assistant",
        content: type === "report" ? result.report : `${result.message}\n${result.anomalies?.map((item) => JSON.stringify(item)).join("\n") || ""}`,
        ...(type === "report" ? { reportId: result.reportId, createdAt: result.createdAt } : {}),
      }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error.message || "Could not run this analysis while the backend is offline." }]);
    } finally {
      setBusy(false);
    }
  };

  const welcome = analysis
    ? `Your dataset${analysis.sourceName ? ` (${analysis.sourceName})` : ""} is ready. Ask me about trends, regions, products, or risks.`
    : `Hi${user?.name ? ` ${user.name.split(/\s+/)[0]}` : ""}! Ask a question, or add a dataset for data-specific insights.`;

  return (
    <section className="panel chat-panel chat-drawer" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div className="panel-heading">
        <div>
          <h2 id="chat-title">Ask Datawise AI</h2>
          <p>{analysis ? `Questions about ${analysis.sourceName || "your current dataset"}` : "Your BI copilot is ready when you add data"}</p>
        </div>
        <div className="chat-heading-actions">
          <span className="ai-status"><i></i> Online</span>
          <button className="chat-close" type="button" aria-label="Close AI assistant" onClick={onClose}>×</button>
        </div>
      </div>
      <div className="chat-messages" aria-live="polite">
        {historyLoading && <div className="chat-typing">Loading your chat history…</div>}
        {!historyLoading && !messages.length && <div className="chat-welcome">{welcome}</div>}
        {messages.map((message, index) => (
          <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
            <span className="chat-avatar">{message.role === "assistant" ? "✦" : "You"}</span>
            <div className="chat-content">{message.role === "assistant" ? <InsightReport content={message.content} analysis={analysis} metricNames={workspace?.metrics} fileId={analysis?.fileId} reportId={message.reportId} createdAt={message.createdAt} /> : message.content}</div>
          </div>
        ))}
        {busy && <div className="chat-typing">Analyzing your data...</div>}
      </div>
      <div className="chat-actions">
        <button onClick={() => runAction("report")} disabled={!analysis || busy || historyLoading}>▣ Weekly report</button>
        <button onClick={() => runAction("anomalies")} disabled={!analysis || busy || historyLoading}>⌁ Find anomalies</button>
      </div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your business data..."
          aria-label="Ask about your business data"
          disabled={historyLoading || busy}
        />
        <button type="submit" aria-label="Send message" disabled={historyLoading || busy || !question.trim()}>→</button>
      </form>
    </section>
  );
}

export default ChatPanel;
