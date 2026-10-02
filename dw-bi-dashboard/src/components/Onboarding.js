import { useState } from "react";

const steps = [
  { kicker: "WELCOME TO DATAWISE", title: "Your business, in one clear view.", body: "Datawise brings your files, metrics and decisions into one intelligent workspace.", icon: "✦" },
  { kicker: "STEP 01", title: "Connect your data", body: "Upload a CSV or Excel file, or choose a connector. Your data stays inside your private workspace.", icon: "↑" },
  { kicker: "STEP 02", title: "Let AI find the story", body: "Datawise automatically surfaces trends, top performers, risks and unusual patterns.", icon: "⌁" },
  { kicker: "STEP 03", title: "Ask better questions", body: "Use Ask Datawise AI to explore your numbers in plain language and generate executive reports.", icon: "?" },
];

function Onboarding({ onFinish, onImport, storageKey }) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const finish = () => { localStorage.setItem(storageKey, "true"); onFinish(); };
  return <div className="onboarding-backdrop"><section className="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><button className="onboarding-skip" onClick={finish}>Skip tour</button><div className="onboarding-art"><div className="onboarding-orbit"><span>▦</span><span>↗</span><span>◯</span><div>{current.icon}</div></div></div><div className="onboarding-copy"><span className="eyebrow">{current.kicker}</span><h2 id="onboarding-title">{current.title}</h2><p>{current.body}</p><div className="onboarding-dots">{steps.map((item, index) => <i className={index === step ? "active" : ""} key={item.title}></i>)}</div><div className="onboarding-actions">{step > 0 && <button className="onboarding-back" onClick={() => setStep(step - 1)}>Back</button>}{step === 0 ? <button className="onboarding-next" onClick={() => setStep(1)}>Show me around <span>→</span></button> : step === steps.length - 1 ? <button className="onboarding-next" onClick={finish}>Open workspace <span>→</span></button> : <button className="onboarding-next" onClick={() => setStep(step + 1)}>Next <span>→</span></button>}</div><button className="onboarding-upload" onClick={() => { finish(); onImport(); }}>Skip tour and upload data now <span>＋</span></button></div></section></div>;
}

export default Onboarding;
