"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

type ApiResponseState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

const defaultItems = JSON.stringify(
  [
    { id: "i1", name: "Obj A" },
    { id: "i2", name: "Obj B" },
  ],
  null,
  2
);

const defaultMetrics = JSON.stringify(
  [
    { name: "Score", type: "numeric", direction: "MAX", weight: 1 },
  ],
  null,
  2
);

export default function HomePage() {
  const { data: session, status } = useSession();
  const [itemsInput, setItemsInput] = useState(defaultItems);
  const [metricsInput, setMetricsInput] = useState(defaultMetrics);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [responseState, setResponseState] = useState<ApiResponseState>({
    status: "idle",
    message: "",
  });

  const isLoading = responseState.status === "loading";

  const handleRun = async () => {
    let items: unknown;
    let metrics: unknown;

    try {
      items = JSON.parse(itemsInput);
    } catch (error) {
      setResponseState({ status: "error", message: `Items JSON parse error: ${String(error)}` });
      return;
    }

    try {
      metrics = JSON.parse(metricsInput);
    } catch (error) {
      setResponseState({ status: "error", message: `Metrics JSON parse error: ${String(error)}` });
      return;
    }

    setResponseState({ status: "loading", message: "" });

    try {
      const res = await fetch("/api/projects/demo/agent/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items,
          metrics,
          use_web_search: useWebSearch,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        setResponseState({ status: "error", message: text || `Request failed with status ${res.status}` });
        return;
      }

      try {
        const json = JSON.parse(text);
        setResponseState({ status: "success", message: JSON.stringify(json, null, 2) });
      } catch (error) {
        setResponseState({ status: "error", message: `Failed to parse response JSON: ${String(error)}\n${text}` });
      }
    } catch (error) {
      setResponseState({ status: "error", message: `Request failed: ${String(error)}` });
    }
  };

  if (status === "loading") {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <p>Loading session...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 600 }}>Tier Rank</h1>
        <p>Sign in to run the scoring agent.</p>
        <button
          type="button"
          onClick={() => signIn()}
          style={{
            backgroundColor: "#2563eb",
            border: "none",
            borderRadius: "0.375rem",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            padding: "0.75rem 1.5rem",
          }}
        >
          Sign in
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem",
        backgroundColor: "#f9fafb",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", fontWeight: 600, marginBottom: "1.5rem" }}>Tier Rank</h1>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
        }}
      >
        <section
          style={{
            flex: "1 1 320px",
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div>
            <label htmlFor="items" style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Items
            </label>
            <textarea
              id="items"
              value={itemsInput}
              onChange={(event) => setItemsInput(event.target.value)}
              style={{
                width: "100%",
                height: "12rem",
                fontFamily: "monospace",
                fontSize: "0.9rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                padding: "0.75rem",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label htmlFor="metrics" style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
              Metrics
            </label>
            <textarea
              id="metrics"
              value={metricsInput}
              onChange={(event) => setMetricsInput(event.target.value)}
              style={{
                width: "100%",
                height: "12rem",
                fontFamily: "monospace",
                fontSize: "0.9rem",
                borderRadius: "0.5rem",
                border: "1px solid #d1d5db",
                padding: "0.75rem",
                boxSizing: "border-box",
              }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={useWebSearch}
              onChange={(event) => setUseWebSearch(event.target.checked)}
              disabled={isLoading}
            />
            use_web_search
          </label>
          <button
            type="button"
            onClick={handleRun}
            disabled={isLoading}
            style={{
              backgroundColor: "#2563eb",
              border: "none",
              borderRadius: "0.5rem",
              color: "white",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: 600,
              padding: "0.75rem 1.5rem",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Running..." : "Run Scoring"}
          </button>
          {responseState.status === "error" && (
            <p
              style={{
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "0.5rem",
                color: "#991b1b",
                fontSize: "0.9rem",
                padding: "0.75rem",
              }}
            >
              {responseState.message}
            </p>
          )}
        </section>
        <section
          style={{
            flex: "1 1 320px",
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            minHeight: "400px",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.75rem" }}>Response</h2>
          <pre
            style={{
              backgroundColor: "#111827",
              color: "#bbf7d0",
              borderRadius: "0.5rem",
              border: "1px solid #1f2937",
              flex: 1,
              margin: 0,
              overflow: "auto",
              padding: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "monospace",
              fontSize: "0.85rem",
            }}
          >
            {responseState.message || "Run the scoring agent to see output."}
          </pre>
        </section>
      </div>
    </main>
  );
}
