import { SLOTS, prettyDate, normalizeEntrySlots, meaningfulSlots } from "./slots.js";

export const FULL_HEAD = ["Date", "Member", "Time Slot", "Tasks", "Blockage / Reason", "Extra Hours", "Extra Work"];
// Per-member exports drop the redundant "Member" column.
export const SOLO_HEAD = FULL_HEAD.filter((h) => h !== "Member");

const XLSX_WIDTH = { Date: 14, Member: 22, "Time Slot": 15, Tasks: 50, "Blockage / Reason": 36, "Extra Hours": 12, "Extra Work": 36 };
// Millimetres on landscape A4. "Tasks" takes whatever width is left.
const PDF_WIDTH = { Date: 23, Member: 30, "Time Slot": 24, "Blockage / Reason": 50, "Extra Hours": 19, "Extra Work": 46 };

const slotLabel = (id) => SLOTS.find((s) => s.id === id)?.label || id;

// One row per slot that actually has content. Empty slots are skipped so the
// report stays short instead of carrying blank lines per person per day.
export function toRows(entries, { withMember = true } = {}) {
  const rows = [];
  for (const e of entries) {
    const slots = meaningfulSlots(normalizeEntrySlots(e.slots));
    if (!slots.length && !e.extraHours && !e.extraWork) continue;
    const lead = [prettyDate(e.date), ...(withMember ? [e.memberName || "-"] : [])];
    const extras = [String(e.extraHours || ""), e.extraWork || ""];
    if (!slots.length) {
      rows.push([...lead, "-", "", "", ...extras]);
      continue;
    }
    slots.forEach((s, i) => {
      rows.push([
        ...lead,
        slotLabel(s.id),
        s.tasks.map((t, n) => `${n + 1}. ${t}`).join("\n"),
        s.blockage || "",
        ...(i === 0 ? extras : ["", ""]),
      ]);
    });
  }
  return rows;
}

export function reportStats(entries) {
  let tasks = 0;
  let blockages = 0;
  let extraHours = 0;
  for (const e of entries) {
    for (const s of meaningfulSlots(normalizeEntrySlots(e.slots))) {
      tasks += s.tasks.length;
      if (s.blockage && s.blockage.trim()) blockages += 1;
    }
    const h = parseFloat(e.extraHours);
    if (!Number.isNaN(h)) extraHours += h;
  }
  return { sheets: entries.length, tasks, blockages, extraHours: Math.round(extraHours * 10) / 10 };
}

/* ------------------------------ Excel ------------------------------ */

function uniqueSheetNames(names) {
  const used = new Set();
  return names.map((raw) => {
    const base = (raw || "Sheet").replace(/[[\]:*?/\\]/g, "-").trim().slice(0, 31) || "Sheet";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 26)} (${n})`;
    used.add(name.toLowerCase());
    return name;
  });
}

// sheets: [{ name, head, rows }]
export async function buildWorkbook(ExcelJS, sheets) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TeamTracker";
  const names = uniqueSheetNames(sheets.map((s) => s.name));
  const edge = { style: "thin", color: { argb: "FFC3DCCC" } };
  const border = { top: edge, left: edge, bottom: edge, right: edge };

  sheets.forEach((s, idx) => {
    const ws = wb.addWorksheet(names[idx], { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.head.map((h) => ({ header: h, width: XLSX_WIDTH[h] || 16 }));
    s.rows.forEach((r) => ws.addRow(r));

    ws.eachRow({ includeEmpty: true }, (row, n) => {
      for (let c = 1; c <= s.head.length; c++) {
        const cell = row.getCell(c);
        cell.border = border;
        cell.alignment = { vertical: n === 1 ? "middle" : "top", wrapText: true };
        if (n === 1) {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15803D" } };
        } else if (n % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
        }
      }
    });
    ws.getRow(1).height = 22;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.head.length } };
  });

  return wb.xlsx.writeBuffer();
}

/* ------------------------------- PDF ------------------------------- */

const GREEN = [22, 163, 74];
const GREEN_DARK = [21, 128, 61];
const TINT = [240, 253, 244];
const LINE = [195, 220, 204];
const INK = [18, 40, 27];
const MUTED = [107, 130, 117];

function pdfColumnStyles(head, usable) {
  const fixed = head.reduce((n, h) => n + (PDF_WIDTH[h] || 0), 0);
  const styles = {};
  head.forEach((h, i) => {
    styles[i] = { cellWidth: h === "Tasks" ? usable - fixed : PDF_WIDTH[h] };
    if (h === "Extra Hours") styles[i].halign = "center";
    if (h === "Date" || h === "Member") styles[i].fontStyle = "bold";
  });
  return styles;
}

// Turns the Date / Member cells and the per-day extra-work cells into row
// spans, so each person's day reads as one boxed group in the grid. A span never
// covers more than one day-sheet, so every group fits on a single page.
function spanBody(rows, head) {
  const keyCols = head.includes("Member") ? 2 : 1;
  const extraCols = ["Extra Hours", "Extra Work"].map((h) => head.indexOf(h));
  const key = (r, upto) => r.slice(0, upto).join("|");
  const out = rows.map(() => []);

  head.forEach((_, c) => {
    const upto = c < keyCols || extraCols.includes(c) ? keyCols : 0;
    if (!upto) {
      rows.forEach((r, i) => out[i].push(r[c]));
      return;
    }
    for (let i = 0; i < rows.length; ) {
      let j = i + 1;
      while (j < rows.length && key(rows[j], upto) === key(rows[i], upto)) j++;
      out[i].push(j - i > 1 ? { content: rows[i][c], rowSpan: j - i } : rows[i][c]);
      i = j;
    }
  });
  return out;
}

// sections: [{ title, head, rows, meta: [[label, value], ...] }]
export function buildReportPdf({ jsPDF, autoTable, sections, rangeText, generatedAt }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  const header = (title) => {
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, W, 22, "F");
    doc.setFillColor(...GREEN_DARK);
    doc.rect(0, 22, W, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, M, 10.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(rangeText, M, 16.8);
    doc.text(`Generated ${generatedAt}`, W - M, 16.8, { align: "right" });
  };

  sections.forEach((sec, idx) => {
    if (idx > 0) doc.addPage();
    header(sec.title);

    let y = 32;
    if (sec.meta?.length) {
      let x = M;
      doc.setFontSize(8.5);
      for (const [label, value] of sec.meta) {
        doc.setFont("helvetica", "normal");
        const labelText = `${label}  `;
        const lw = doc.getTextWidth(labelText);
        doc.setFont("helvetica", "bold");
        const vw = doc.getTextWidth(String(value));
        const w = lw + vw + 8;
        doc.setFillColor(...TINT);
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y - 4.6, w, 6.8, 1.6, 1.6, "FD");
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        doc.text(labelText, x + 4, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...INK);
        doc.text(String(value), x + 4 + lw, y);
        x += w + 3;
      }
      y += 7;
    }

    const keyCols = sec.head.includes("Member") ? 2 : 1;
    autoTable(doc, {
      head: [sec.head],
      body: sec.rows.length
        ? spanBody(sec.rows, sec.head)
        : [[{ content: "No entries in this range", colSpan: sec.head.length, styles: { halign: "center", textColor: MUTED } }]],
      startY: y,
      margin: { top: 30, left: M, right: M, bottom: 15 },
      theme: "grid",
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: { top: 2.3, bottom: 2.3, left: 2.5, right: 2.5 },
        overflow: "linebreak",
        valign: "top",
        lineColor: LINE,
        lineWidth: 0.25,
        textColor: INK,
      },
      headStyles: {
        fillColor: GREEN_DARK,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        valign: "middle",
        lineColor: [255, 255, 255],
        lineWidth: 0.25,
      },
      columnStyles: pdfColumnStyles(sec.head, W - 2 * M),
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index < keyCols) d.cell.styles.fillColor = TINT;
      },
      didDrawPage: () => header(sec.title),
    });
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, H - 10, W - M, H - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("TeamTracker - Daily Work Report", M, H - 5.5);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 5.5, { align: "right" });
  }
  return doc;
}
