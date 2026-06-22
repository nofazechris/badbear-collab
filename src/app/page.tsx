"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type CollabStatus = "none" | "dmsent" | "closed" | "failed";

// Edit this list to add/remove VAs — keeps names consistent without needing logins.
const VA_NAMES = ["Unassigned", "Captain", "Flux", "Big Ben"];

interface Project {
  id: number;
  symbol: string;
  name: string;
  description: string | null;
  twitter: string | null;
  status: CollabStatus;
  assigned_to: string | null;
  updated_at: string;
}

interface ActivityEntry {
  id: number;
  project_symbol: string;
  project_name: string;
  va_name: string;
  status: CollabStatus;
  created_at: string;
}

interface LeaderboardRow {
  va_name: string;
  closed_count: string;
  dmsent_count: string;
  total_actions: string;
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
  const [tab, setTab] = useState<"projects" | "log">("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CollabStatus>("all");
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);

  const [logVa, setLogVa] = useState(VA_NAMES[1] || VA_NAMES[0]);
  const [logProject, setLogProject] = useState("");
  const [logStatus, setLogStatus] = useState<CollabStatus>("dmsent");
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, aRes] = await Promise.all([fetch("/api/collections"), fetch("/api/activity")]);
      if (!pRes.ok || !aRes.ok) throw new Error("Request failed");
      const pData = await pRes.json();
      const aData = await aRes.json();
      setProjects(pData.projects || []);
      setActivityLog(aData.log || []);
      setLeaderboard(aData.leaderboard || []);
    } catch (e) {
      setError("Couldn't load data. Check that DATABASE_URL is set correctly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateProject = async (symbol: string, status: CollabStatus, assigned_to: string) => {
    setSavingSymbol(symbol);
    setProjects((prev) => prev.map((p) => (p.symbol === symbol ? { ...p, status, assigned_to } : p)));
    try {
      const res = await fetch("/api/collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, status, assigned_to, va_name: assigned_to })
      });
      if (!res.ok) throw new Error("Failed");
      const aRes = await fetch("/api/activity");
      if (aRes.ok) {
        const aData = await aRes.json();
        setActivityLog(aData.log || []);
        setLeaderboard(aData.leaderboard || []);
      }
    } catch (e) {
      setError("Update didn't save. Try again.");
      loadAll();
    } finally {
      setSavingSymbol(null);
    }
  };

  const submitLogEntry = async () => {
    if (!logProject.trim() || logVa === "Unassigned") {
      setError("Pick a VA and enter a project/person name before logging.");
      return;
    }
    setLogSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ va_name: logVa, project_name: logProject.trim(), status: logStatus })
      });
      if (!res.ok) throw new Error("Failed");
      setLogProject("");
      const aRes = await fetch("/api/activity");
      if (aRes.ok) {
        const aData = await aRes.json();
        setActivityLog(aData.log || []);
        setLeaderboard(aData.leaderboard || []);
      }
    } catch (e) {
      setError("Couldn't save that log entry. Try again.");
    } finally {
      setLogSubmitting(false);
    }
  };

  const updateLogEntry = async (id: number, status: CollabStatus) => {
    setEditingId(id);
    setActivityLog((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
    try {
      const res = await fetch("/api/activity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (!res.ok) throw new Error("Failed");
      const aRes = await fetch("/api/activity");
      if (aRes.ok) {
        const aData = await aRes.json();
        setActivityLog(aData.log || []);
        setLeaderboard(aData.leaderboard || []);
      }
    } catch (e) {
      setError("Couldn't update that entry. Try again.");
    } finally {
      setEditingId(null);
    }
  };

  const deleteLogEntry = async (id: number) => {
    const prev = activityLog;
    setActivityLog((p) => p.filter((e) => e.id !== id));
    try {
      const res = await fetch(`/api/activity?id=${id}`, { method: "DELETE" });
      // 404 means it's already gone (e.g. a duplicate click) — that's fine,
      // the end state we want (no row with this id) is already true.
      if (!res.ok && res.status !== 404) throw new Error("Failed");
      const aRes = await fetch("/api/activity");
      if (aRes.ok) {
        const aData = await aRes.json();
        setLeaderboard(aData.leaderboard || []);
      }
    } catch (e) {
      setError("Couldn't delete that entry. Try again.");
      setActivityLog(prev);
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
    const headers = ["name", "symbol", "description", "twitter", "status", "assigned_to"];
    const rows = filtered.map((p) => [
      p.name,
      p.symbol,
      (p.description || "").replace(/\n/g, " "),
      p.twitter || "",
      STATUS_LABEL[p.status],
      p.assigned_to || ""
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
          marginBottom: 20
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Badbear Colab</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Solana NFT outreach tracker
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={loadAll} style={btnStyle}>
            Refresh
          </button>
          <button onClick={exportCsv} style={btnStyle}>
            Export CSV
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
        <TabButton active={tab === "projects"} onClick={() => setTab("projects")}>
          Projects
        </TabButton>
        <TabButton active={tab === "log"} onClick={() => setTab("log")}>
          Outreach log
        </TabButton>
      </div>

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

      {tab === "projects" ? (
        <>
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

          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
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
            <EmptyState text="No projects yet. POST a snapshot to /api/seed to load data." />
          ) : (
            <>
              <div className="table-view" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <Th>Name</Th>
                      <Th>Description</Th>
                      <Th>X</Th>
                      <Th>Assigned to</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.symbol} style={{ borderBottom: "1px solid var(--border)" }}>
                        <Td style={{ fontWeight: 500 }}>{p.name}</Td>
                        <Td style={{ color: "var(--text-secondary)" }}>
                          {(p.description || "").slice(0, 60)}
                          {(p.description || "").length > 60 ? "…" : ""}
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
                        <Td style={{ minWidth: 120 }}>
                          <select
                            value={p.assigned_to || "Unassigned"}
                            disabled={savingSymbol === p.symbol}
                            onChange={(e) => updateProject(p.symbol, p.status, e.target.value)}
                            style={{ ...inputStyle, height: 36, fontSize: 12, width: "100%" }}
                          >
                            {VA_NAMES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </Td>
                        <Td style={{ minWidth: 140 }}>
                          <StatusSelect
                            value={p.status}
                            disabled={savingSymbol === p.symbol}
                            onChange={(s) => updateProject(p.symbol, s, p.assigned_to || "Unassigned")}
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
                    <div style={{ marginBottom: 8 }}>
                      {p.twitter ? (
                        <a href={p.twitter} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                          X profile
                        </a>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No X on file</span>
                      )}
                    </div>
                    <label style={labelStyle}>Assigned to</label>
                    <select
                      value={p.assigned_to || "Unassigned"}
                      disabled={savingSymbol === p.symbol}
                      onChange={(e) => updateProject(p.symbol, p.status, e.target.value)}
                      style={{ ...inputStyle, width: "100%", marginBottom: 10 }}
                    >
                      {VA_NAMES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <label style={labelStyle}>Status</label>
                    <StatusSelect
                      value={p.status}
                      disabled={savingSymbol === p.symbol}
                      onChange={(s) => updateProject(p.symbol, s, p.assigned_to || "Unassigned")}
                      fullWidth
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 18,
              marginBottom: 24
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px" }}>Log an outreach action</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select value={logVa} onChange={(e) => setLogVa(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                {VA_NAMES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                value={logProject}
                onChange={(e) => setLogProject(e.target.value)}
                placeholder="Project or contact name..."
                style={{ ...inputStyle, flex: 1, minWidth: 160 }}
              />
              <select
                value={logStatus}
                onChange={(e) => setLogStatus(e.target.value as CollabStatus)}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="dmsent">DM sent</option>
                <option value="closed">Closed</option>
                <option value="failed">Failed</option>
              </select>
              <button
                onClick={submitLogEntry}
                disabled={logSubmitting}
                style={{ ...btnStyle, opacity: logSubmitting ? 0.6 : 1 }}
              >
                {logSubmitting ? "Saving..." : "Log it"}
              </button>
            </div>
          </div>

          <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px" }}>Leaderboard</p>
          {leaderboard.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>No activity logged yet.</p>
          ) : (
            <div style={{ overflowX: "auto", marginBottom: 32 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <Th>VA</Th>
                    <Th>Closed</Th>
                    <Th>DMs sent</Th>
                    <Th>Total actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.va_name} style={{ borderBottom: "1px solid var(--border)" }}>
                      <Td style={{ fontWeight: 500 }}>{row.va_name}</Td>
                      <Td style={{ color: "var(--success)" }}>{row.closed_count}</Td>
                      <Td style={{ color: "var(--accent)" }}>{row.dmsent_count}</Td>
                      <Td>{row.total_actions}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px" }}>Recent activity</p>
          {activityLog.length === 0 ? (
            <EmptyState text="No outreach logged yet." />
          ) : (
            <div>
              {activityLog.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                    flexWrap: "wrap",
                    opacity: editingId === entry.id ? 0.6 : 1
                  }}
                >
                  <div style={{ minWidth: 160 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{entry.va_name}</span>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}> → {entry.project_name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <select
                      value={entry.status}
                      disabled={editingId === entry.id}
                      onChange={(e) => updateLogEntry(entry.id, e.target.value as CollabStatus)}
                      style={{
                        fontSize: 12,
                        padding: "5px 8px",
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        background: STATUS_COLOR[entry.status].bg,
                        color: STATUS_COLOR[entry.status].color
                      }}
                    >
                      <option value="none">Not contacted</option>
                      <option value="dmsent">DM sent</option>
                      <option value="closed">Closed</option>
                      <option value="failed">Failed</option>
                    </select>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete this log entry for ${entry.project_name}?`)) {
                          deleteLogEntry(entry.id);
                        }
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "5px 10px",
                        fontSize: 12,
                        color: "var(--danger)"
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        padding: "10px 4px",
        marginRight: 20,
        fontSize: 14,
        fontWeight: 500,
        color: active ? "var(--text-primary)" : "var(--text-secondary)"
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
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
      <p style={{ margin: 0, fontSize: 13 }}>{text}</p>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "14px 16px" }}>
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
  return <th style={{ textAlign: "left", padding: "8px 8px", color: "var(--text-secondary)", fontWeight: 500 }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 8px", ...style }}>{children}</td>;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--text-secondary)",
  marginBottom: 4
};

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
