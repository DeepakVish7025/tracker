"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { todayStr, prettyDate } from "@/lib/slots";

export default function Home() {
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const r = await fetch("/api/members");
    setMembers(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addMember = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role }),
    });
    if (!r.ok) setErr((await r.json()).error || "Could not add member");
    else { setName(""); setRole(""); await load(); }
    setBusy(false);
  };

  const removeMember = async (m) => {
    if (!confirm(`Delete ${m.name} and all their entries?`)) return;
    await fetch(`/api/members/${m._id}`, { method: "DELETE" });
    load();
  };

  return (
    <>
      <h1>Team Dashboard</h1>
      <p className="sub">Today is {prettyDate(todayStr())}. Open your page and fill the slot-wise task sheet.</p>

      <div className="card">
        <h2>Add Team Member</h2>
        <form onSubmit={addMember} className="row">
          <div>
            <label>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deepak Vishwakarma" />
          </div>
          <div>
            <label>Role / Designation</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Automation Engineer" />
          </div>
          <div style={{ flex: "0 0 auto", minWidth: 0 }}>
            <button disabled={busy}>{busy ? "Adding..." : "Create Member"}</button>
          </div>
        </form>
        {err && <p className="note" style={{ color: "var(--danger)", marginTop: 10 }}>{err}</p>}
      </div>

      <div className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Team Members ({members.length})</h2>
          <Link href="/reports" className="btn btn-ghost">Weekly Report</Link>
        </div>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : members.length === 0 ? (
          <div className="empty">No members yet. Add your 5 team members above.</div>
        ) : (
          <div className="grid">
            {members.map((m) => (
              <div key={m._id} className="member">
                <Link href={`/member/${m._id}`}>
                  <div className="avatar">{m.name.charAt(0).toUpperCase()}</div>
                  <div className="name">{m.name}</div>
                  <div className="role">{m.role || "Team Member"}</div>
                </Link>
                <button
                  className="btn-ghost"
                  style={{ marginTop: 12, padding: "5px 10px", fontSize: 12, color: "var(--danger)" }}
                  onClick={() => removeMember(m)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
