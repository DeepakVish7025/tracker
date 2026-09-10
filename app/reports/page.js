"use client";

import { useEffect, useMemo, useState } from "react";
import { todayStr, prettyDate, weekRange, shiftDate } from "@/lib/slots";
import { initials, avatarColor } from "@/lib/people";
import { FULL_HEAD, SOLO_HEAD, toRows, reportStats, buildWorkbook, buildReportPdf } from "@/lib/report";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const safeFile = (s) => (s || "report").replace(/[\\/:*?"<>|[\]]/g, "-").trim();

const metaFor = (s) => [
  ["Day-sheets", s.sheets],
  ["Tasks", s.tasks],
  ["Blockages", s.blockages],
  ["Extra hours", s.extraHours],
];

function ReportTable({ head, rows }) {
  return (
    <div className="tablewrap">
      <table className="rtable">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => {
                const h = head[j];
                const cls = [
                  c ? "" : "is-empty",
                  j === 0 ? "first" : "",
                  h === "Tasks" ? "pre" : "",
                  h === "Time Slot" || h === "Extra Hours" ? "nowrap" : "",
                  h === "Date" || h === "Member" ? "strong" : "",
                  h === "Blockage / Reason" && c ? "warn" : "",
                ].filter(Boolean).join(" ");
                return (
                  <td key={j} data-label={h} className={cls}>
                    {c || <span className="dash">&mdash;</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const init = weekRange(todayStr());
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [view, setView] = useState("merged"); // merged | byname
  const [closed, setClosed] = useState(() => new Set());
  const [busy, setBusy] = useState("");

  const load = async (f = from, t = to) => {
    setLoading(true); setMsg("");
    try {
      const r = await fetch(`/api/report?from=${f}&to=${t}`);
      const d = await r.json();
      setEntries(Array.isArray(d) ? d : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(init.from, init.to); }, []);

  const pickWeek = (offset) => {
    const w = weekRange(shiftDate(todayStr(), offset * 7));
    setFrom(w.from); setTo(w.to); load(w.from, w.to);
  };

  // Group once by member; reused by the on-screen view and every export.
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const key = e.memberId || e.memberName || "unknown";
      if (!map.has(key)) map.set(key, { id: key, name: e.memberName || "Unnamed", items: [] });
      map.get(key).items.push(e);
    }
    return [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((g) => ({ ...g, rows: toRows(g.items, { withMember: false }), stats: reportStats(g.items) }));
  }, [entries]);

  const mergedRows = useMemo(() => toRows(entries), [entries]);
  const stats = useMemo(() => reportStats(entries), [entries]);

  const rangeText = `${prettyDate(from)} to ${prettyDate(to)}`;
  const stamp = `${from}_to_${to}`;

  const run = async (key, fn) => {
    setBusy(key); setMsg("");
    try { await fn(); }
    catch (e) { console.error(e); setMsg(`Export failed: ${e.message}`); }
    finally { setBusy(""); }
  };

  const excel = (key, sheets, filename) => run(key, async () => {
    const ExcelJS = (await import("exceljs")).default;
    const buf = await buildWorkbook(ExcelJS, sheets);
    download(new Blob([buf], { type: XLSX_MIME }), filename);
  });

  const pdf = (key, sections, filename) => run(key, async () => {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const generatedAt = new Date().toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    buildReportPdf({ jsPDF, autoTable, sections, rangeText, generatedAt }).save(filename);
  });

  const exportExcel = () =>
    view === "byname"
      ? excel("all-xlsx", groups.map((g) => ({ name: g.name, head: SOLO_HEAD, rows: g.rows })),
          `Team-Report_by-name_${stamp}.xlsx`)
      : excel("all-xlsx", [{ name: "Team Report", head: FULL_HEAD, rows: mergedRows }],
          `Team-Report_${stamp}.xlsx`);

  const exportPdf = () =>
    view === "byname"
      ? pdf("all-pdf", groups.map((g) => ({
          title: `${g.name} - Work Report`, head: SOLO_HEAD, rows: g.rows, meta: metaFor(g.stats),
        })), `Team-Report_by-name_${stamp}.pdf`)
      : pdf("all-pdf", [{
          title: "Team Work Report", head: FULL_HEAD, rows: mergedRows,
          meta: [["Members", groups.length], ...metaFor(stats)],
        }], `Team-Report_${stamp}.pdf`);

  const memberExcel = (g) =>
    excel(`${g.id}-xlsx`, [{ name: g.name, head: SOLO_HEAD, rows: g.rows }], `${safeFile(g.name)}_${stamp}.xlsx`);

  const memberPdf = (g) =>
    pdf(`${g.id}-pdf`, [{ title: `${g.name} - Work Report`, head: SOLO_HEAD, rows: g.rows, meta: metaFor(g.stats) }],
      `${safeFile(g.name)}_${stamp}.pdf`);

  const toggle = (gid) =>
    setClosed((prev) => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });

  const wipe = async () => {
    if (!confirm(`Delete ALL entries from ${rangeText}? Export first — this cannot be undone.`)) return;
    const r = await fetch(`/api/report?from=${from}&to=${to}`, { method: "DELETE" });
    const d = await r.json();
    await load();
    setMsg(`${d.deleted} entries deleted. Database cleaned up.`);
  };

  const none = !entries.length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Reports &amp; Export</div>
          <h1>Weekly Team Report</h1>
          <p className="sub">Pick a range, review merged or name-wise, export to Excel or PDF, then clear old data to keep the database light.</p>
        </div>
      </div>

      <div className="card">
        <div className="field-row">
          <div className="field narrow">
            <label htmlFor="r-from">From</label>
            <input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field narrow">
            <label htmlFor="r-to">To</label>
            <input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="btnrow">
            <button type="button" className="btn" onClick={() => load()}>Load report</button>
            <button type="button" className="btn btn-ghost" onClick={() => pickWeek(0)}>This week</button>
            <button type="button" className="btn btn-ghost" onClick={() => pickWeek(-1)}>Last week</button>
          </div>
        </div>
      </div>

      <div className="stats five">
        <div className="stat accent"><div className="val">{stats.sheets}</div><div className="lbl">Day-sheets</div></div>
        <div className="stat"><div className="val">{groups.length}</div><div className="lbl">Members</div></div>
        <div className="stat"><div className="val">{stats.tasks}</div><div className="lbl">Tasks logged</div></div>
        <div className="stat"><div className="val">{stats.blockages}</div><div className="lbl">Blockages</div></div>
        <div className="stat"><div className="val">{stats.extraHours}</div><div className="lbl">Extra hours</div></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="Report view">
            <button type="button" role="tab" aria-selected={view === "merged"}
              className={view === "merged" ? "tab on" : "tab"} onClick={() => setView("merged")}>Merged</button>
            <button type="button" role="tab" aria-selected={view === "byname"}
              className={view === "byname" ? "tab on" : "tab"} onClick={() => setView("byname")}>Name-wise</button>
          </div>
          <div className="btnrow">
            <button type="button" className="btn" onClick={exportExcel} disabled={none || !!busy}>
              {busy === "all-xlsx" ? "Preparing…" : "Export Excel"}
            </button>
            <button type="button" className="btn btn-soft" onClick={exportPdf} disabled={none || !!busy}>
              {busy === "all-pdf" ? "Preparing…" : "Export PDF"}
            </button>
            <button type="button" className="btn btn-danger" onClick={wipe} disabled={none || !!busy}>
              Delete range
            </button>
          </div>
        </div>

        <div className="note" style={{ marginBottom: 14 }}>
          {rangeText} &middot; {view === "byname"
            ? "Exports get one sheet / page per member"
            : "All members in one table"}
        </div>

        {msg && <p className={msg.startsWith("Export failed") ? "err" : "okmsg"} style={{ margin: "0 0 14px" }}>{msg}</p>}

        {loading ? (
          <div className="empty">Loading&hellip;</div>
        ) : none ? (
          <div className="empty">
            <div className="empty-icon">📄</div>
            No entries found in this range.
          </div>
        ) : view === "merged" ? (
          mergedRows.length ? <ReportTable head={FULL_HEAD} rows={mergedRows} /> : <div className="empty">Sheets were saved but have no tasks yet.</div>
        ) : (
          groups.map((g) => {
            const isOpen = !closed.has(g.id);
            return (
              <div className={isOpen ? "person open" : "person"} key={g.id}>
                <div className="person-head">
                  <button type="button" className="person-toggle" aria-expanded={isOpen} onClick={() => toggle(g.id)}>
                    <span className="caret" aria-hidden="true">&#9656;</span>
                    <span className="avatar" style={{ background: avatarColor(g.name) }}>{initials(g.name)}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="pname">{g.name}</span>
                      <span className="pmeta">
                        {g.stats.sheets} days &middot; {g.stats.tasks} tasks &middot; {g.stats.blockages} blockages &middot; {g.stats.extraHours} extra hrs
                      </span>
                    </span>
                  </button>
                  <div className="btnrow">
                    <button type="button" className="btn btn-sm" onClick={() => memberExcel(g)} disabled={!!busy}>
                      {busy === `${g.id}-xlsx` ? "Preparing…" : "Excel"}
                    </button>
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => memberPdf(g)} disabled={!!busy}>
                      {busy === `${g.id}-pdf` ? "Preparing…" : "PDF"}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="person-body">
                    {g.rows.length
                      ? <ReportTable head={SOLO_HEAD} rows={g.rows} />
                      : <div className="empty">No task entries.</div>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
