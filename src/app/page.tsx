"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type CollabStatus = "none" | "dmsent" | "closed" | "failed";

interface Project {
  id: number;
  symbol: string;
  name: string;
  description: string | null;
  twitter: string | null;
  status: CollabStatus;
  updated_at: string;
}

const STATUS_LABEL: Record<CollabStatus, string> = {
  none: "Not contacted",
  dmsent: "DM sent",
  closed: "Closed",
  failed: "Failed"
};

const STATUS_COLOR: Record<CollabStatus, { bg: string; color: string }> = {
  none: { bg: "var(--surface)", color: "var(--text-secondary)" },
  dmsent: { bg: "var(--accent-bg)", color: "var(--accent)" },
  closed: { bg: "var(--success-bg)", color: "var(--success)" },
  failed: { bg: "var(--danger-bg)", color: "var(--danger)" }
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CollabStatus>("all");
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/collections");
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (e) {
      setError("Couldn't load projects. Check that DATABASE_URL is set correctly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const updateStatus = async (symbol: string, status: CollabStatus) => {
    setSavingSymbol(symbol);
    setProjects((prev) => prev.map((p) => (p.symbol === symbol ? { ...p, status } : p)));
    try {
      const res = await fetch("/api/collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, status })
      });
      if (!res.ok) throw new Error("Failed");
    } catch (e) {
      setError("Status update didn't save. Try again.");
      loadProjects();
    } finally {
      setSavingSymbol(null);
    }
  };

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [projects, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: projects.length,
      dmsent: projects.filter((p) => p.status === "dmsent").length,
      closed: projects.filter((p) => p.status === "closed").length,
      failed: projects.filter((p) => p.status === "failed").length
    };
  }, [projects]);

  const exportCsv = () => {
    const headers = ["name", "symbol", "description", "twitter", "status"];
    const rows = filtered.map((p) => [
      p.name,
      p.symbol,
      (p.description || "").replace(/\n/g, " "),
      p.twitter || "",
      STATUS_LABEL[p.status]
    ]);
    const csv = [headers.join(",")]
      .concat(rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "collab_targets.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Badbear Colab</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Solana NFT outreach tracker
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={loadProjects} style={btnStyle}>
            Refresh
          </button>
          <button onClick={exportCsv} style={btnStyle}>
            Export CSV
          </button>
        </div>
      </header>

      {error && (
        <div
          style={{
            background: "var(--danger-bg)",
            color: "var(--danger)",
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            marginBottom: 20
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 12,
          marginBottom: 24
        }}
      >
        <StatCard label="Total projects" value={counts.total} />
        <StatCard label="DM sent" value={counts.dmsent} color="var(--accent)" />
        <StatCard label="Closed" value={counts.closed} color="var(--success)" />
        <StatCard label="Failed" value={counts.failed} color="var(--danger)" />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap"
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project name..."
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{ ...inputStyle, width: "auto" }}
        >
          <option value="all">Any status</option>
          <option value="none">Not contacted</option>
          <option value="dmsent">DM sent</option>
          <option value="closed">Closed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-secondary)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)"
          }}
        >
          <p style={{ margin: "0 0 4px", fontWeight: 500 }}>No projects yet</p>
          <p style={{ margin: 0, fontSize: 13 }}>
            POST a snapshot to <code>/api/seed</code> to load data.
          </p>
        </div>
      ) : (
        <>
          <div className="table-view" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <Th>Name</Th>
                  <Th>Description</Th>
                  <Th>X</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.symbol} style={{ borderBottom: "1px solid var(--border)" }}>
                    <Td style={{ fontWeight: 500 }}>{p.name}</Td>
                    <Td style={{ color: "var(--text-secondary)" }}>
                      {(p.description || "").slice(0, 80)}
                      {(p.description || "").length > 80 ? "…" : ""}
                    </Td>
                    <Td>
                      {p.twitter ? (
                        <a href={p.twitter} target="_blank" rel="noreferrer">
                          link
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>—</span>
                      )}
                    </Td>
                    <Td style={{ minWidth: 150 }}>
                      <StatusSelect
                        value={p.status}
                        disabled={savingSymbol === p.symbol}
                        onChange={(s) => updateStatus(p.symbol, s)}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-view">
            {filtered.map((p) => (
              <div key={p.symbol} style={cardStyle}>
                <p style={{ fontWeight: 500, fontSize: 15, margin: "0 0 4px" }}>{p.name}</p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
                  {p.description}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  {p.twitter ? (
                    <a href={p.twitter} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                      X profile
                    </a>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No X on file</span>
                  )}
                </div>
                <StatusSelect
                  value={p.status}
                  disabled={savingSymbol === p.symbol}
                  onChange={(s) => updateStatus(p.symbol, s)}
                  fullWidth
                />
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        .card-view { display: none; }
        @media (max-width: 640px) {
          .table-view { display: none; }
          .card-view { display: block; }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "14px 16px"
      }}
    >
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, color: color || "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
  disabled,
  fullWidth
}: {
  value: CollabStatus;
  onChange: (s: CollabStatus) => void;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const colors = STATUS_COLOR[value];
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as CollabStatus)}
      style={{
        ...inputStyle,
        width: fullWidth ? "100%" : "auto",
        height: 36,
        fontSize: 12,
        background: colors.bg,
        color: colors.color,
        borderColor: "var(--border)",
        opacity: disabled ? 0.6 : 1
      }}
    >
      <option value="none">Not contacted</option>
      <option value="dmsent">DM sent</option>
      <option value="closed">Closed</option>
      <option value="failed">Failed</option>
    </select>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "8px 8px",
        color: "var(--text-secondary)",
        fontWeight: 500
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 8px", ...style }}>{children}</td>;
}

const btnStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)"
};

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
  minHeight: 36
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "14px 16px",
  marginBottom: 10
};
