"use client";

import { useEffect, useState } from "react";
import { SLOTS, todayStr, prettyDate, weekRange } from "@/lib/slots";

const HEAD = ["Date", "Member", "Time Slot", "Task 1", "Task 2", "Blockage / Reason", "Extra Hours", "Extra Work"];

function toRows(entries) {
  const rows = [];
  for (const e of entries) {
    SLOTS.forEach((s, i) => {
      const v = (e.slots || []).find((x) => x.id === s.id) || {};
      rows.push([
        prettyDate(e.date),
        e.memberName || "-",
        s.label,
        v.task1 || "",
        v.task2 || "",
        v.blockage || "",
        i === 0 ? String(e.extraHours || "") : "",
        i === 0 ? e.extraWork || "" : "",
      ]);
    });
  }
  return rows;
}

export default function Reports() {
  const init = weekRange(todayStr());
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async (f = from, t = to) => {
    setLoading(true); setMsg("");
    const r = await fetch(`/api/report?from=${f}&to=${t}`);
    setEntries(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(init.from, init.to); }, []);

  const thisWeek = () => {
    const w = weekRange(todayStr());
    setFrom(w.from); setTo(w.to); load(w.from, w.to);
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([HEAD, ...toRows(entries)]);
    ws["!cols"] = [{ wch: 13 }, { wch: 20 }, { wch: 20 }, { wch: 32 }, { wch: 32 }, { wch: 32 }, { wch: 12 }, { wch: 32 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Team Report");
    XLSX.writeFile(wb, `Team-Report_${from}_to_${to}.xlsx`);
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Team Weekly Work Report", 14, 14);
    doc.setFontSize(10);
    doc.text(`${prettyDate(from)}  to  ${prettyDate(to)}`, 14, 21);
    autoTable(doc, {
      head: [HEAD],
      body: toRows(entries),
      startY: 26,
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 2: { cellWidth: 28 } },
    });
    doc.save(`Team-Report_${from}_to_${to}.pdf`);
  };

  const wipe = async () => {
    if (!confirm(`Delete ALL entries from ${prettyDate(from)} to ${prettyDate(to)}? Export first — this cannot be undone.`)) return;
    const r = await fetch(`/api/report?from=${from}&to=${to}`, { method: "DELETE" });
    const d = await r.json();
    setMsg(`${d.deleted} entries deleted. Database cleaned up.`);
    load();
  };

  const rows = toRows(entries);
  const members = [...new Set(entries.map((e) => e.memberName))].filter(Boolean);

  return (
    <>
      <h1>Reports &amp; Export</h1>
      <p className="sub">Pick a date range, export to Excel or PDF, then clear old data to keep the free database light.</p>

      <div className="card">
        <div className="row">
          <div style={{ maxWidth: 190 }}>
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div style={{ maxWidth: 190 }}>
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div style={{ flex: "0 0 auto", minWidth: 0, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => load()}>Load Report</button>
            <button className="btn-ghost" onClick={thisWeek}>This Week</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 style={{ margin: 0 }}>
              {entries.length} day-sheets &middot; {members.length} members &middot; {rows.length} rows
            </h2>
            <span className="note">{prettyDate(from)} to {prettyDate(to)}</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn-ok" onClick={exportExcel} disabled={!entries.length}>Export Excel</button>
            <button onClick={exportPdf} disabled={!entries.length}>Export PDF</button>
            <button className="btn-danger" onClick={wipe} disabled={!entries.length}>Delete This Range</button>
          </div>
        </div>

        {msg && <p className="saved">{msg}</p>}

        {loading ? (
          <div className="empty">Loading...</div>
        ) : !entries.length ? (
          <div className="empty">No entries found in this range.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr>{HEAD.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{c || <span style={{ color: "#c3cad6" }}>&mdash;</span>}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
