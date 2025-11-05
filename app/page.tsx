"use client";
import { useState } from "react";

export default function Page() {
  const [items, setItems] = useState(`[{"id":"i1","name":"Obj A"},{"id":"i2","name":"Obj B"}]`);
  const [metrics, setMetrics] = useState(`[{"name":"Score","type":"numeric","direction":"MAX","weight":1}]`);
  const [useWeb, setUseWeb] = useState(false);
  const [out, setOut] = useState("");

  async function run() {
    const res = await fetch("/api/projects/demo/agent/score", {
      method: "POST",
      headers: {"content-type":"application/json"},
      body: JSON.stringify({ items: JSON.parse(items), metrics: JSON.parse(metrics), use_web_search: useWeb })
    });
    setOut(await res.text());
  }

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <section>
        <h1>🚀 Tier Rank – テストフォーム</h1>
        <label>Items JSON</label>
        <textarea value={items} onChange={e=>setItems(e.target.value)} rows={6} style={{width:"100%"}}/>
        <label>Metrics JSON</label>
        <textarea value={metrics} onChange={e=>setMetrics(e.target.value)} rows={6} style={{width:"100%"}}/>
        <div style={{marginTop:8}}>
          <label><input type="checkbox" checked={useWeb} onChange={e=>setUseWeb(e.target.checked)}/> 根拠を集める（Web検索ON）</label>
        </div>
        <button onClick={run} style={{marginTop:12, padding:"8px 14px"}}>Run Scoring</button>
      </section>
      <section>
        <h2>Result</h2>
        <pre style={{whiteSpace:"pre-wrap"}}>{out}</pre>
      </section>
    </main>
  );
}
