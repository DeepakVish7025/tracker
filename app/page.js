"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { todayStr, prettyDate } from "@/lib/slots";
import { initials, avatarColor } from "@/lib/people";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
        fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const today = todayStr();
  const [members, setMembers] = useState([]);
  const [doneToday, setDoneToday] = useState(() => new Set());
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const [m, e] = await Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch(`/api/report?from=${today}&to=${today}`).then((r) => r.json()),
    ]);
    setMembers(Array.isArray(m) ? m : []);
    setDoneToday(new Set((Array.isArray(e) ? e : []).map((x) => x.memberId)));
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

  const submitted = members.filter((m) => doneToday.has(m._id)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Team Dashboard</div>
          <h1>Daily Work Sheets</h1>
          <p className="sub">Open your name, fill today&apos;s slots and save. Every day starts with a fresh sheet.</p>
        </div>
        <span className="chip"><span className="dot" />{prettyDate(today)}</span>
      </div>

      <div className="stats">
        <div className="stat accent">
          <div className="val">{members.length}</div>
          <div className="lbl">Team members</div>
        </div>
        <div className="stat">
          <div className="val">{submitted}</div>
          <div className="lbl">Submitted today</div>
        </div>
        <div className="stat">
          <div className="val">{Math.max(members.length - submitted, 0)}</div>
          <div className="lbl">Pending today</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Team members</h2>
            <div className="card-sub">Tap a name to open the daily sheet</div>
          </div>
          <Link href="/reports" className="btn btn-ghost btn-sm">View reports</Link>
        </div>

        {loading ? (
          <div className="empty">Loading team&hellip;</div>
        ) : members.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👥</div>
            No members yet. Add your team below.
          </div>
        ) : (
          <div className="grid">
            {members.map((m) => {
              const done = doneToday.has(m._id);
              return (
                <div key={m._id} className="mcard">
                  <Link href={`/member/${m._id}`} className="mcard-main">
                    <div className="avatar" style={{ background: avatarColor(m.name) }}>{initials(m.name)}</div>
                    <div className="mcard-info">
                      <div className="name">{m.name}</div>
                      <div className="role">{m.role || "Team Member"}</div>
                    </div>
                  </Link>
                  <div className="mcard-foot">
                    <span className={done ? "badge ok" : "badge wait"}>{done ? "Submitted" : "Pending"}</span>
                    <div className="btnrow">
                      <button
                        type="button"
                        className="btn btn-icon"
                        title={`Remove ${m.name}`}
                        aria-label={`Remove ${m.name}`}
                        onClick={() => removeMember(m)}
                      >
                        <TrashIcon />
                      </button>
                      <Link href={`/member/${m._id}`} className="btn btn-soft btn-sm">Open sheet &rarr;</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Add team member</h2>
            <div className="card-sub">Each member gets their own daily sheet page</div>
          </div>
        </div>
        <form onSubmit={addMember} className="form-grid">
          <div>
            <label htmlFor="m-name">Full name</label>
            <input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deepak Vishwakarma" />
          </div>
          <div>
            <label htmlFor="m-role">Role / designation</label>
            <input id="m-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Automation Engineer" />
          </div>
          <button className="btn" disabled={busy || !name.trim()}>{busy ? "Adding…" : "+ Add member"}</button>
        </form>
        {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      </div>
    </>
  );
}
