import { useState } from "react";

const categories = ["Hospital", "Healthcare", "Education", "Real estate", "Manufacturing", "Logistics", "Marketing agency", "Human resources", "Custom business"];
const metricOptions = ["Revenue / income", "Customers / users", "Operations", "Projects / tasks", "Inventory / assets", "Marketing performance", "Quality / compliance", "Team performance"];
const dataOptions = ["CSV or Excel files", "Database", "API or connected app", "I am not sure yet"];

function WorkspaceSetup({ onComplete, onCancel, initialWorkspace }) {
  const [category, setCategory] = useState(initialWorkspace?.category || "");
  const [metrics, setMetrics] = useState(initialWorkspace?.metrics || []);
  const [dataType, setDataType] = useState(initialWorkspace?.dataType || "");
  const [goal, setGoal] = useState(initialWorkspace?.goal || "");
  const [error, setError] = useState("");

  const toggleMetric = (metric) => {
    setMetrics((current) => current.includes(metric)
      ? current.filter((item) => item !== metric)
      : [...current, metric]);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!category || metrics.length === 0 || !dataType) {
      setError("Choose a business category, at least one metric, and your data source.");
      return;
    }
    onComplete({
      category,
      metrics,
      dataType,
      goal: goal.trim() || "Understand performance and make better decisions.",
    });
  };

  const skipSetup = () => onComplete({
    category: "General business",
    metrics: ["Revenue / income", "Customers / users"],
    dataType: "I am not sure yet",
    goal: "Understand performance and make better decisions.",
  });

  return (
    <main className="setup-page">
      <div className="setup-brand">
        <div className="brand-mark">D</div>
        <strong>Datawise</strong>
        <span>{initialWorkspace ? "Edit workspace" : "Workspace setup"}</span>
      </div>
      <form className="setup-card" onSubmit={submit}>
        <div className="setup-progress"><span className="active"></span><span className="active"></span><span className="active"></span></div>
        <span className="eyebrow">PERSONALIZE YOUR WORKSPACE</span>
        <h1>{initialWorkspace ? "Choose what this dashboard should show" : "What should your dashboard help you understand?"}</h1>
        <p className="setup-intro">Select only the metrics you want in this workspace. You can create a separate workspace for another domain at any time.</p>

        <section className="setup-label" aria-labelledby="workspace-category-label">
          <div id="workspace-category-label">What type of work do you do?</div>
          <div className="setup-options">
            {categories.map((item) => (
              <button type="button" className={category === item ? "selected" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>
            ))}
          </div>
        </section>

        <section className="setup-label" aria-labelledby="workspace-metrics-label">
          <div id="workspace-metrics-label">What do you want to track?</div>
          <small>Only selected metrics will appear in this workspace.</small>
          <div className="setup-options metric-options">
            {metricOptions.map((item) => (
              <button type="button" className={metrics.includes(item) ? "selected" : ""} key={item} onClick={() => toggleMetric(item)}>
                {metrics.includes(item) ? "✓ " : "＋ "}{item}
              </button>
            ))}
          </div>
        </section>

        <section className="setup-label" aria-labelledby="workspace-data-label">
          <div id="workspace-data-label">Where will your data come from?</div>
          <div className="setup-options compact-options">
            {dataOptions.map((item) => (
              <button type="button" className={dataType === item ? "selected" : ""} key={item} onClick={() => setDataType(item)}>{item}</button>
            ))}
          </div>
        </section>

        <div className="setup-label">
          <label htmlFor="workspace-goal">What is the main question you want answered? <span>Optional</span></label>
          <textarea id="workspace-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Example: Which clinics are busiest and where are we losing time?" />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="setup-footer">
          {initialWorkspace && onCancel && <button type="button" className="setup-later" onClick={onCancel}>Cancel</button>}
          {!initialWorkspace && <button type="button" className="setup-later" onClick={skipSetup}>Skip for now</button>}
          <button className="primary-button setup-submit" type="submit">{initialWorkspace ? "Save workspace" : "Build my workspace"} <span>→</span></button>
        </div>
      </form>
    </main>
  );
}

export default WorkspaceSetup;
