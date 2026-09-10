"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  SLOTS, LUNCH_IDS, MIN_TASKS, emptySlots, normalizeEntrySlots,
  todayStr, prettyDate,
} from "@/lib/slots";
import { initials, avatarColor } from "@/lib/people";

// "Slot 1..4" numbering that skips the lunch break.
const WORK_NO = Object.fromEntries(SLOTS.filter((s) => !s.lunch).map((s, i) => [s.id, i + 1]));

function Check({ size = 30 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    // Lunch has no inputs; make sure nothing stale is stored against it.
    const clean = slots.map((s) =>
      LUNCH_IDS.has(s.id) ? { ...s, tasks: Array(MIN_TASKS).fill(""), blockage: "" } : s
    );
    const r = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: id,
        memberName: member?.name || "",
        date, slots: clean, extraHours, extraWork,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setSlots(clean);
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

  const workSlots = slots.filter((s) => !LUNCH_IDS.has(s.id));
  const totalTasks = workSlots.reduce((n, s) => n + s.tasks.filter((t) => t.trim()).length, 0);
  const filledSlots = workSlots.filter((s) => s.tasks.some((t) => t.trim())).length;
  const blockages = workSlots.filter((s) => s.blockage.trim()).length;
  const isToday = date === todayStr();

  return (
    <>
      <Link href="/" className="back">&larr; Back to dashboard</Link>

      <div className="card">
        <div className="profile">
          <div className="profile-id">
            <div className="avatar lg" style={{ background: avatarColor(member?.name || "") }}>
              {member ? initials(member.name) : ""}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1>{member ? member.name : "Loading…"}</h1>
              <div className="sub">{member?.role || "Team Member"}</div>
            </div>
          </div>
          <div className="field date-field">
            <label htmlFor="sheet-date">Sheet date</label>
            <input id="sheet-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
        </div>
        <div className="hint">
          <span aria-hidden="true">📅</span>
          <span>
            Showing the sheet for <strong>{prettyDate(date)}</strong>
            {isToday && <span className="badge ok" style={{ marginLeft: 8 }}>Today</span>}
            <br />
            Each date is saved separately &mdash; tomorrow opens as a fresh, empty sheet.
          </span>
        </div>
      </div>

      {loading ? (
        <div className="card empty">Loading sheet&hellip;</div>
      ) : submitted ? (
        <div className="card done-card">
          <div className="tick"><Check /></div>
          <h2>Sheet submitted for {prettyDate(date)}</h2>
          <p className="note">Your entry is saved in the team database.</p>
          <div className="summary">
            <div><div className="big">{totalTasks}</div><div className="lbl">Tasks</div></div>
            <div><div className="big">{filledSlots}</div><div className="lbl">Slots filled</div></div>
            <div><div className="big">{blockages}</div><div className="lbl">Blockages</div></div>
            <div><div className="big">{extraHours || "0"}</div><div className="lbl">Extra hours</div></div>
          </div>
          <div className="btnrow">
            <button type="button" className="btn btn-ghost" onClick={() => setSubmitted(false)}>Edit this sheet</button>
            <Link href="/" className="btn">Back to dashboard</Link>
          </div>
        </div>
      ) : (
        <>
          {SLOTS.map((s) => {
            if (s.lunch) {
              return (
                <div key={s.id} className="lunch-banner" role="note">
                  <div className="lunch-icon" aria-hidden="true">🍽️</div>
                  <div>
                    <div className="lunch-title">Lunch Break</div>
                    <div className="lunch-sub">Relax &mdash; no entry needed for this slot</div>
                  </div>
                  <div className="lunch-time">{s.label}</div>
                </div>
              );
            }

            const v = slots.find((x) => x.id === s.id);
            if (!v) return null;
            const n = WORK_NO[s.id];
            const filled = v.tasks.filter((t) => t.trim()).length;
            return (
              <div key={s.id} className="slot">
                <div className="slot-head">
                  <div className="slot-title">
                    <span className="slot-no">Slot {n}</span>
                    <span className="slot-time">{s.label}</span>
                  </div>
                  <span className={filled ? "slot-count done" : "slot-count"}>
                    {filled}/{v.tasks.length} filled
                  </span>
                </div>
                <div className="slot-body">
                  {v.tasks.map((t, i) => (
                    <div className="taskline" key={i}>
                      <span className="task-num" aria-hidden="true">{i + 1}</span>
                      <input
                        value={t}
                        aria-label={`Slot ${n}, task ${i + 1}`}
                        onChange={(e) => setTask(s.id, i, e.target.value)}
                        placeholder={i === 0 ? "What did you work on?" : "Another task in this slot"}
                      />
                      {v.tasks.length > MIN_TASKS ? (
                        <button type="button" className="x-btn" title="Remove this task"
                          aria-label={`Remove task ${i + 1}`} onClick={() => removeTask(s.id, i)}>&times;</button>
                      ) : (
                        <span className="x-space" aria-hidden="true" />
                      )}
                    </div>
                  ))}

                  <button type="button" className="add-task" onClick={() => addTask(s.id)}>
                    + Add task
                  </button>

                  <div className="blockage">
                    <label htmlFor={`block-${s.id}`}>Blockage / reason (if work wasn&apos;t done)</label>
                    <input
                      id={`block-${s.id}`}
                      value={v.blockage}
                      onChange={(e) => setBlockage(s.id, e.target.value)}
                      placeholder="Kaam nahi hua to kya wajah thi?"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="card">
            <div className="card-head" style={{ marginBottom: 14 }}>
              <div>
                <h2>Extra work</h2>
                <div className="card-sub">Worked beyond 6:30? Log it here.</div>
              </div>
            </div>
            <div className="field-row">
              <div className="field narrow">
                <label htmlFor="xh">Extra hours</label>
                <input id="xh" type="number" inputMode="decimal" min="0" step="0.5" value={extraHours}
                  onChange={(e) => setExtraHours(e.target.value)} placeholder="e.g. 1.5" />
              </div>
              <div className="field">
                <label htmlFor="xw">What extra work did you do?</label>
                <input id="xw" value={extraWork} onChange={(e) => setExtraWork(e.target.value)}
                  placeholder="Describe the extra work done" />
              </div>
            </div>
          </div>

          <div className="save-bar">
            <span className={error ? "err" : "note"}>
              {error || `${totalTasks} task${totalTasks === 1 ? "" : "s"} across ${filledSlots} slot${filledSlots === 1 ? "" : "s"}`}
            </span>
            <button type="button" className="btn" onClick={save} disabled={saving}>
              {saving ? "Saving…" : `Save sheet for ${prettyDate(date)}`}
            </button>
          </div>
        </>
      )}

      {popup && (
        <div className="overlay" onClick={() => setPopup(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="tick"><Check size={32} /></div>
            <h3>Saved successfully</h3>
            <p>Sheet for <strong>{prettyDate(date)}</strong> has been saved.</p>
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPopup(false)}>Close</button>
              <Link href="/" className="btn">Back to dashboard</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
