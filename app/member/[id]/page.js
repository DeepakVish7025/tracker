"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  SLOTS, MIN_TASKS, emptySlots, normalizeEntrySlots,
  todayStr, prettyDate,
} from "@/lib/slots";

export default function MemberPage({ params }) {
  const { id } = use(params);
  const [member, setMember] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState(emptySlots());
  const [extraHours, setExtraHours] = useState("");
  const [extraWork, setExtraWork] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [popup, setPopup] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/members/${id}`).then((r) => r.json()).then(setMember);
  }, [id]);

  // Loads the sheet for the selected date. A date with no saved entry
  // always comes back as a blank template, so tomorrow starts empty.
  useEffect(() => {
    setLoading(true);
    setError("");
    setPopup(false);
    fetch(`/api/entries?memberId=${id}&date=${date}`)
      .then((r) => r.json())
      .then((e) => {
        setSlots(normalizeEntrySlots(e.slots));
        setExtraHours(e.extraHours || "");
        setExtraWork(e.extraWork || "");
        setSubmitted(!!e.saved);
        setLoading(false);
      });
  }, [id, date]);

  const patchSlot = (sid, fn) =>
    setSlots((prev) => prev.map((s) => (s.id === sid ? fn(s) : s)));

  const setTask = (sid, i, value) =>
    patchSlot(sid, (s) => ({ ...s, tasks: s.tasks.map((t, k) => (k === i ? value : t)) }));

  const addTask = (sid) => patchSlot(sid, (s) => ({ ...s, tasks: [...s.tasks, ""] }));

  const removeTask = (sid, i) =>
    patchSlot(sid, (s) => ({ ...s, tasks: s.tasks.filter((_, k) => k !== i) }));

  const setBlockage = (sid, value) => patchSlot(sid, (s) => ({ ...s, blockage: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    const r = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: id,
        memberName: member?.name || "",
        date, slots, extraHours, extraWork,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setSubmitted(true);
      setPopup(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setError("Save failed. Please check your connection and try again.");
    }
  };

  // Auto-dismiss the popup; the form stays closed underneath.
  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(false), 3000);
    return () => clearTimeout(t);
  }, [popup]);

  const totalTasks = slots.reduce((n, s) => n + s.tasks.filter((t) => t.trim()).length, 0);
  const filledSlots = slots.filter((s) => s.tasks.some((t) => t.trim())).length;
  const blockages = slots.filter((s) => s.blockage.trim()).length;

  return (
    <>
      <p className="note" style={{ marginBottom: 8 }}>
        <Link href="/">&larr; Back to Dashboard</Link>
      </p>
      <h1>{member ? member.name : "Loading..."}</h1>
      <p className="sub">{member?.role || "Team Member"} &middot; Daily slot-wise work sheet</p>

      <div className="card">
        <div className="row">
          <div style={{ maxWidth: 220 }}>
            <label>Report Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <p className="note" style={{ margin: 0 }}>
              Showing sheet for <strong>{prettyDate(date)}</strong>. Har date ka sheet alag save hota hai &mdash;
              kal ka form apne aap khaali milega.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card empty">Loading sheet...</div>
      ) : submitted ? (
        <div className="card done-card">
          <div className="tick">&#10003;</div>
          <h2>Sheet submitted for {prettyDate(date)}</h2>
          <p className="note">Your entry is saved in the team database.</p>
          <div className="summary">
            <div><div className="big">{totalTasks}</div><div className="lbl">Tasks</div></div>
            <div><div className="big">{filledSlots}</div><div className="lbl">Slots filled</div></div>
            <div><div className="big">{blockages}</div><div className="lbl">Blockages</div></div>
            <div><div className="big">{extraHours || "0"}</div><div className="lbl">Extra hours</div></div>
          </div>
          <div className="btnrow">
            <button className="btn-ghost" onClick={() => setSubmitted(false)}>Edit this sheet</button>
            <Link href="/" className="btn">Back to Dashboard</Link>
          </div>
        </div>
      ) : (
        <>
          {SLOTS.map((s) => {
            const v = slots.find((x) => x.id === s.id);
            if (!v) return null;
            return (
              <div key={s.id} className={`slot${s.lunch ? " lunch" : ""}`}>
                <div className="slot-head">
                  <span>{s.label}</span>
                  <span className={`pill${s.lunch ? " lunchpill" : ""}`}>{s.lunch ? "Break" : "Work Slot"}</span>
                </div>
                <div className="slot-body">
                  {v.tasks.map((t, i) => (
                    <div className="taskline" key={i}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <label>Task {i + 1}</label>
                        <input
                          value={t}
                          onChange={(e) => setTask(s.id, i, e.target.value)}
                          placeholder={i === 0 ? "What did you work on?" : "Another task in this slot"}
                        />
                      </div>
                      {v.tasks.length > MIN_TASKS && (
                        <button type="button" className="x-btn" title="Remove this task"
                          onClick={() => removeTask(s.id, i)}>&times;</button>
                      )}
                    </div>
                  ))}

                  <button type="button" className="add-task" onClick={() => addTask(s.id)}>
                    + Add task
                  </button>

                  <div>
                    <label>Blockage / Reason (if work not done)</label>
                    <input value={v.blockage} onChange={(e) => setBlockage(s.id, e.target.value)}
                      placeholder="Kaam nahi hua to kya wajah thi?" />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="card">
            <h2>Extra Work</h2>
            <div className="row">
              <div style={{ maxWidth: 200, flex: "0 0 200px" }}>
                <label>Extra Work Hours</label>
                <input type="number" min="0" step="0.5" value={extraHours}
                  onChange={(e) => setExtraHours(e.target.value)} placeholder="e.g. 1.5" />
              </div>
              <div>
                <label>Kya extra work kiya</label>
                <input value={extraWork} onChange={(e) => setExtraWork(e.target.value)}
                  placeholder="Describe the extra work done" />
              </div>
            </div>
          </div>

          <div className="card save-bar">
            <span className="note" style={{ color: error ? "var(--danger)" : "var(--muted)" }}>
              {error || "Sheet save hone ke baad form band ho jayega."}
            </span>
            <button className="btn-ok" onClick={save} disabled={saving}>
              {saving ? "Saving..." : `Save Sheet for ${prettyDate(date)}`}
            </button>
          </div>
        </>
      )}

      {popup && (
        <div className="overlay" onClick={() => setPopup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="tick">&#10003;</div>
            <h3>Saved successfully</h3>
            <p>Sheet for <strong>{prettyDate(date)}</strong> has been saved.</p>
            <div className="actions">
              <button className="btn-ghost" onClick={() => setPopup(false)}>Close</button>
              <Link href="/" className="btn">Back to Dashboard</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
