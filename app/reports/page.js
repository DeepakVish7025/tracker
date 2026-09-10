"use client";

import { useEffect, useMemo, useState } from "react";
import { SLOTS, todayStr, prettyDate, weekRange, normalizeEntrySlots, meaningfulSlots } from "@/lib/slots";

const FULL_HEAD = ["Date", "Member", "Time Slot", "Tasks", "Blockage / Reason", "Extra Hours", "Extra Work"];
const FULL_WIDTHS = [14, 20, 22, 48, 34, 12, 34];
// Per-member exports drop the redundant "Member" column.
const SOLO_HEAD = FULL_HEAD.filter((h) => h !== "Member");
const SOLO_WIDTHS = FULL_WIDTHS.filter((_, i) => FULL_HEAD[i] !== "Member");

const slotLabel = (id) => SLOTS.find((s) => s.id === id)?.label || id;

// One row per slot that actually has content. Empty slots are skipped so the
// report stays short instead of carrying five blank lines per person per day.
function toRows(entries, { withMember = true } = {}) {
  const rows = [];
  for (const e of entries) {
    const slots = meaningfulSlots(normalizeEntrySlots(e.slots));
    if (!slots.length && !e.extraHours && !e.extraWork) continue;
    const extras = [String(e.extraHours || ""), e.extraWork || ""];
    if (!slots.length) {
      rows.push([prettyDate(e.date), ...(withMember ? [e.memberName || "-"] : []), "-", "", "", ...extras]);
      continue;
    }
    slots.forEach((s, i) => {
      rows.push([
        prettyDate(e.date),
        ...(withMember ? [e.memberName || "-"] : []),
        slotLabel(s.id),
        s.tasks.map((t, n) => `${n + 1}. ${t}`).join("\n"),
        s.blockage || "",
        ...(i === 0 ? extras : ["", ""]),
      ]);
    });
  }
  return rows;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const safe = (s) => (s || "report").replace(/[\\/:*?"<>|[\]]/g, "-").slice(0, 28);

export default function Reports() {
  const init = weekRange(todayStr());
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [view, setView] = useState("merged"); // merged | byname
  const [open, setOpen] = useState({});

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

  // Group once, reuse for both the on-screen view and every export.
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const key = e.memberName || "Unnamed";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, items]) => ({ name, items, rows: toRows(items, { withMember: false }) }));
  }, [entries]);

  const mergedRows = useMemo(() => toRows(entries), [entries]);

  const styleSheet = (ws, head, widths) => {
    ws.columns = head.map((h, i) => ({ header: h, width: widths[i] }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: "A1", to: { row: 1, column: head.length } };
  };

  const fillSheet = (ws, head, widths, rows) => {
    styleSheet(ws, head, widths);
    rows.forEach((r) => ws.addRow(r));
    ws.eachRow((row, n) => {
      if (n > 1) row.alignment = { vertical: "top", wrapText: true };
    });
  };

  // sheets: [{ name, head, widths, rows }]
  const writeWorkbook = async (sheets, filename) => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    sheets.forEach((s) => fillSheet(wb.addWorksheet(s.name), s.head, s.widths, s.rows));
    const buf = await wb.xlsx.writeBuffer();
    download(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename
    );
  };

  // sections: [{ title, head, rows }]
  const writePdf = async (sections, filename) => {
    const { jsPDF } = await import("jspdf");
    const { autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    sections.forEach((sec, i) => {
      if (i > 0) doc.addPage();
      doc.setFontSize(14);
      doc.text(sec.title, 14, 14);
      doc.setFontSize(10);
      doc.text(`${prettyDate(from)}  to  ${prettyDate(to)}`, 14, 21);
      autoTable(doc, {
        head: [sec.head],
        body: sec.rows,
        startY: 26,
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak", valign: "top" },
        headStyles: { fillColor: [37, 99, 235] },
        columnStyles: { 0: { cellWidth: 22 } },
      });
    });
    doc.save(filename);
  };

  const stamp = `${from}_to_${to}`;

  const exportExcel = () =>
    view === "byname"
      ? writeWorkbook(
          groups.map((g) => ({ name: safe(g.name).slice(0, 31), head: SOLO_HEAD, widths: SOLO_WIDTHS, rows: g.rows })),
          `Team-Report_by-name_${stamp}.xlsx`
        )
      : writeWorkbook(
          [{ name: "Team Report", head: FULL_HEAD, widths: FULL_WIDTHS, rows: mergedRows }],
          `Team-Report_${stamp}.xlsx`
        );

  const exportPdf = () =>
    view === "byname"
      ? writePdf(
          groups.map((g) => ({ title: `${g.name} — Work Report`, head: SOLO_HEAD, rows: g.rows })),
          `Team-Report_by-name_${stamp}.pdf`
        )
      : writePdf(
          [{ title: "Team Weekly Work Report", head: FULL_HEAD, rows: mergedRows }],
          `Team-Report_${stamp}.pdf`
        );

  const memberExcel = (g) =>
    writeWorkbook(
      [{ name: safe(g.name).slice(0, 31), head: SOLO_HEAD, widths: SOLO_WIDTHS, rows: g.rows }],
      `${safe(g.name)}_${stamp}.xlsx`
    );

  const memberPdf = (g) =>
    writePdf([{ title: `${g.name} — Work Report`, head: SOLO_HEAD, rows: g.rows }], `${safe(g.name)}_${stamp}.pdf`);

  const wipe = async () => {
    if (!confirm(`Delete ALL entries from ${prettyDate(from)} to ${prettyDate(to)}? Export first — this cannot be undone.`)) return;
    const r = await fetch(`/api/report?from=${from}&to=${to}`, { method: "DELETE" });
    const d = await r.json();
    setMsg(`${d.deleted} entries deleted. Database cleaned up.`);
    load();
  };

  const Cell = ({ v }) =>
    v ? <span style={{ whiteSpace: "pre-line" }}>{v}</span> : <span style={{ color: "#c3cad6" }}>&mdash;</span>;

  const Table = ({ head, rows }) => (
    <div className="tablewrap">
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}><Cell v={c} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <h1>Reports &amp; Export</h1>
      <p className="sub">Pick a date range, view merged or name-wise, export to Excel or PDF, then clear old data to keep the free database light.</p>

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
          <div className="btnrow" style={{ flex: "0 0 auto" }}>
            <button onClick={() => load()}>Load Report</button>
            <button className="btn-ghost" onClick={thisWeek}>This Week</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 style={{ margin: 0 }}>
              {entries.length} day-sheets &middot; {groups.length} members &middot; {mergedRows.length} rows
            </h2>
            <span className="note">{prettyDate(from)} to {prettyDate(to)}</span>
          </div>
          <div className="tabs">
            <button className={view === "merged" ? "tab on" : "tab"} onClick={() => setView("merged")}>Merged</button>
            <button className={view === "byname" ? "tab on" : "tab"} onClick={() => setView("byname")}>Name-wise</button>
          </div>
        </div>

        <div className="btnrow">
          <button className="btn-ok" onClick={exportExcel} disabled={!entries.length}>
            Export Excel{view === "byname" ? " (sheet per member)" : ""}
          </button>
          <button onClick={exportPdf} disabled={!entries.length}>
            Export PDF{view === "byname" ? " (page per member)" : ""}
          </button>
          <button className="btn-danger" onClick={wipe} disabled={!entries.length}>Delete This Range</button>
        </div>

        {msg && <p className="saved" style={{ marginTop: 12 }}>{msg}</p>}

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div className="empty">Loading...</div>
          ) : !entries.length ? (
            <div className="empty">No entries found in this range.</div>
          ) : view === "merged" ? (
            <Table head={FULL_HEAD} rows={mergedRows} />
          ) : (
            groups.map((g) => {
              const isOpen = open[g.name] !== false;
              return (
                <div className="person" key={g.name}>
                  <div className="person-head">
                    <button
                      className="person-toggle"
                      onClick={() => setOpen((o) => ({ ...o, [g.name]: !isOpen }))}
                    >
                      <span className="caret">{isOpen ? "▾" : "▸"}</span>
                      <span className="pname">{g.name}</span>
                      <span className="note">{g.items.length} days &middot; {g.rows.length} rows</span>
                    </button>
                    <div className="btnrow">
                      <button className="btn-ok small" onClick={() => memberExcel(g)}>Excel</button>
                      <button className="small" onClick={() => memberPdf(g)}>PDF</button>
                    </div>
                  </div>
                  {isOpen && <Table head={SOLO_HEAD} rows={g.rows} />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
