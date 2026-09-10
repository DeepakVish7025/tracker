"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { SLOTS, emptySlots, todayStr, prettyDate } from "@/lib/slots";

export default function MemberPage({ params }) {
  const { id } = use(params);
  const [member, setMember] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState(emptySlots());
  const [extraHours, setExtraHours] = useState("");
  const [extraWork, setExtraWork] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false); // form closed after save
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
        const base = emptySlots();
        const incoming = e.slots || [];
        setSlots(base.map((s) => ({ ...s, ...(incoming.find((x) => x.id === s.id) || {}) })));
        setExtraHours(e.extraHours || "");
        setExtraWork(e.extraWork || "");
        setSubmitted(!!e.saved);
        setLoading(false);
      });
  }, [id, date]);

  const upd = (sid, field, value) =>
    setSlots((prev) => prev.map((s) => (s.id === sid ? { ...s, [field]: value } : s)));

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
      setSubmitted(true);   // close the form
      setPopup(true);       // show saved popup
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

  const filledSlots = slots.filter((s) => s.task1 || s.task2).length;
  const blockages = slots.filter((s) => s.blockage).length;

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
            <div>
              <div className="big">{filledSlots}</div>
              <div className="lbl">Slots filled</div>
            </div>
            <div>
              <div className="big">{blockages}</div>
              <div className="lbl">Blockages</div>
            </div>
            <div>
              <div className="big">{extraHours || "0"}</div>
              <div className="lbl">Extra hours</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-ghost" onClick={() => setSubmitted(false)}>Edit this sheet</button>
            <Link href="/" className="btn">Back to Dashboard</Link>
          </div>
        </div>
      ) : (
        <>
          {SLOTS.map((s) => {
            const v = slots.find((x) => x.id === s.id) || {};
            return (
              <div key={s.id} className={`slot${s.lunch ? " lunch" : ""}`}>
                <div className="slot-head">
                  <span>{s.label}</span>
                  <span className={`pill${s.lunch ? " lunchpill" : ""}`}>{s.lunch ? "Break" : "Work Slot"}</span>
                </div>
                <div className="slot-body">
                  <div>
                    <label>Task 1</label>
                    <input value={v.task1 || ""} onChange={(e) => upd(s.id, "task1", e.target.value)} placeholder="What did you work on?" />
                  </div>
                  <div>
                    <label>Task 2</label>
                    <input value={v.task2 || ""} onChange={(e) => upd(s.id, "task2", e.target.value)} placeholder="Second task (if any)" />
                  </div>
                  <div className="full">
                    <label>Blockage / Reason (if work not done)</label>
                    <input value={v.blockage || ""} onChange={(e) => upd(s.id, "blockage", e.target.value)} placeholder="Kaam nahi hua to kya wajah thi?" />
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
                <input value={extraWork} onChange={(e) => setExtraWork(e.target.value)} placeholder="Describe the extra work done" />
              </div>
            </div>
          </div>

          <div className="card card-head" style={{ marginBottom: 0 }}>
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
            <p>
              {member?.name}&rsquo;s sheet for <strong>{prettyDate(date)}</strong> has been saved.
            </p>
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
