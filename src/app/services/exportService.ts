import type { FilterValues } from "../context/GlobalFilterContext";

export type ExportFormat = "pdf" | "png" | "csv" | "xlsx";

interface ExportRequest {
  format: ExportFormat;
  target: HTMLElement;
  filenameBase: string;
  filters: FilterValues;
}

function filterSummary(filters: FilterValues) {
  return [
    ["Khoảng thời gian", filters.dateRange],
    ["Từ ngày", filters.customDateFrom],
    ["Đến ngày", filters.customDateTo],
    ["Kênh", filters.channel],
    ["Chủ đề", filters.topic],
    ["Trạng thái hội thoại", filters.conversationStatus],
    ["Trạng thái AI", filters.aiStatus],
    ["Loại lỗi AI", filters.aiFailureType],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function createExportSnapshot(target: HTMLElement, filters: FilterValues) {
  const container = document.createElement("div");
  container.dataset.exportSnapshot = "true";
  Object.assign(container.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${Math.max(target.scrollWidth, target.clientWidth, 1200)}px`,
    background: "#fff",
    color: "#003865",
    zIndex: "-1",
  });
  const summary = document.createElement("section");
  summary.setAttribute("aria-label", "Bộ lọc đã áp dụng trong file xuất");
  summary.style.cssText = "padding:16px 20px;border:1px solid #dbe4ec;border-radius:12px;margin-bottom:16px;background:#fff";
  const title = document.createElement("h2");
  title.textContent = "Bộ lọc đã áp dụng";
  title.style.cssText = "margin:0 0 10px;font-size:16px";
  const values = document.createElement("div");
  values.style.cssText = "display:flex;flex-wrap:wrap;gap:8px 16px;font-size:12px";
  filterSummary(filters).forEach(([label, value]) => {
    const item = document.createElement("span");
    item.textContent = `${label}: ${value}`;
    values.appendChild(item);
  });
  summary.append(title, values);

  const clone = target.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>("[hidden]").forEach((element) => { element.hidden = false; });
  clone.querySelectorAll<HTMLElement>("[data-print-hidden='true'], .print-hidden").forEach((element) => element.remove());
  container.append(summary, clone);
  document.body.appendChild(container);
  return container;
}

export function collectTableData(target: HTMLElement): { headers: string[]; rows: string[][] } {
  const table = target.querySelector("table");
  if (!table) return { headers: [], rows: [] };
  return {
    headers: Array.from(table.querySelectorAll("thead th")).map((cell) => cell.textContent?.trim() ?? ""),
    rows: Array.from(table.querySelectorAll("tbody tr")).map((row) => (
      Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent?.trim() ?? "")
    )),
  };
}

function safeSpreadsheetCell(value: string) {
  const safe = /^[=+@-]/.test(value.trimStart()) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function safeWorkbookCell(value: string) {
  return /^[=+@-]/.test(value.trimStart()) ? `'${value}` : value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportRows(data: { headers: string[]; rows: string[][] }, filters: FilterValues) {
  return [
    ["Bộ lọc đã áp dụng", ""],
    ...filterSummary(filters),
    [],
    data.headers,
    ...data.rows,
  ];
}

function exportCsv(data: { headers: string[]; rows: string[][] }, filters: FilterValues, filename: string) {
  const lines = exportRows(data, filters).map((row) => row.map(safeSpreadsheetCell).join(","));
  downloadBlob(new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), filename);
}

async function renderSnapshot(target: HTMLElement, filters: FilterValues) {
  const snapshot = createExportSnapshot(target, filters);
  try {
    const { default: html2canvas } = await import("html2canvas");
    return await html2canvas(snapshot, {
      backgroundColor: "#ffffff",
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      logging: false,
      width: snapshot.scrollWidth,
      height: snapshot.scrollHeight,
      windowWidth: snapshot.scrollWidth,
      windowHeight: snapshot.scrollHeight,
    });
  } finally {
    snapshot.remove();
  }
}

export async function exportDashboardData({ format, target, filenameBase, filters }: ExportRequest) {
  if (format === "csv" || format === "xlsx") {
    const data = collectTableData(target);
    if (!data.headers.length) return { rowCount: 0, hasTable: false };
    if (format === "csv") {
      exportCsv(data, filters, `${filenameBase}.csv`);
    } else {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Dữ liệu");
      worksheet.addRows(exportRows(data, filters).map((row) => row.map(safeWorkbookCell)));
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(filterSummary(filters).length + 3).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `${filenameBase}.xlsx`,
      );
    }
    return { rowCount: data.rows.length, hasTable: true };
  }

  const canvas = await renderSnapshot(target, filters);
  if (format === "png") {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${filenameBase}.png`;
    link.click();
    return { rowCount: 0, hasTable: true };
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imageHeight = (canvas.height * pageWidth) / canvas.width;
  let remaining = imageHeight;
  let offset = 0;
  const image = canvas.toDataURL("image/png");
  pdf.addImage(image, "PNG", 0, offset, pageWidth, imageHeight, undefined, "FAST");
  remaining -= pageHeight;
  while (remaining > 0) {
    offset = -(imageHeight - remaining);
    pdf.addPage();
    pdf.addImage(image, "PNG", 0, offset, pageWidth, imageHeight, undefined, "FAST");
    remaining -= pageHeight;
  }
  pdf.save(`${filenameBase}.pdf`);
  return { rowCount: 0, hasTable: true };
}
