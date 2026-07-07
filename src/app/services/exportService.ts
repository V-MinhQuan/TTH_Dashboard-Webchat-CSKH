import type { FilterValues } from "../context/GlobalFilterContext";

export type ExportFormat = "pdf" | "png" | "csv" | "xlsx";

interface ExportRequest {
  format: ExportFormat;
  target: HTMLElement;
  filenameBase: string;
  filters: FilterValues;
  rawData?: { headers: string[]; rows: string[][] };
}

function filterSummary(filters: FilterValues) {
  return [
    ["Khoảng thời gian", filters.dateRange],
    ["Từ ngày", filters.customDateFrom],
    ["Đến ngày", filters.customDateTo],
    ["Kênh", filters.channel],
    ["Chủ đề", filters.topic],
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

export interface TableData {
  title?: string;
  headers: string[];
  rows: string[][];
}

export function collectAllTableData(target: HTMLElement): TableData[] {
  const tables = Array.from(target.querySelectorAll("table"));
  return tables.map((table, index) => {
    let title = `Bảng dữ liệu ${index + 1}`;
    
    // Try to find a preceding title element
    let sibling = table.previousElementSibling;
    let attempts = 0;
    while (sibling && attempts < 3) {
      if (sibling.tagName.match(/^H[1-6]$/i)) {
        title = sibling.textContent?.trim() || title;
        break;
      }
      const heading = sibling.querySelector("h2, h3, h4, h5, h6");
      if (heading) {
        title = heading.textContent?.trim() || title;
        break;
      }
      sibling = sibling.previousElementSibling;
      attempts++;
    }

    const cellText = (cell: Element) => {
      const clone = cell.cloneNode(true) as HTMLElement;
      clone.querySelectorAll<HTMLElement>("[data-print-hidden='true'], .print-hidden").forEach((element) => element.remove());
      return clone.textContent?.trim() ?? "";
    };
    return {
      title,
      headers: Array.from(table.querySelectorAll("thead th")).map(cellText),
      rows: Array.from(table.querySelectorAll("tbody tr")).map((row) => (
        Array.from(row.querySelectorAll("td")).map(cellText)
      )),
    };
  }).filter(data => data.headers.length > 0 || data.rows.length > 0);
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
    let html2canvas: any;
    try {
      const mod = await import("html2canvas/dist/html2canvas.esm.js");
      html2canvas = mod.default || mod;
    } catch (e) {
      const mod = await import("html2canvas");
      html2canvas = mod.default || mod;
    }
    
    if (typeof html2canvas !== "function") {
      if (html2canvas && typeof html2canvas.default === "function") {
        html2canvas = html2canvas.default;
      } else if (typeof (window as any).html2canvas === "function") {
        html2canvas = (window as any).html2canvas;
      } else {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        html2canvas = (window as any).html2canvas;
        if (typeof html2canvas !== "function") {
          throw new Error("Không thể khởi tạo html2canvas kể cả bằng CDN.");
        }
      }
    }

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

export async function exportDashboardData({ format, target, filenameBase, filters, rawData }: ExportRequest) {
  if (format === "csv" || format === "xlsx") {
    const allDatasets: TableData[] = [];
    if (rawData && (rawData.headers?.length > 0 || rawData.rows?.length > 0)) {
      allDatasets.push({ title: "Tổng quan", headers: rawData.headers, rows: rawData.rows });
    }
    
    const tables = collectAllTableData(target);
    allDatasets.push(...tables);

    if (allDatasets.length === 0) return { rowCount: 0, hasTable: false };

    if (format === "csv") {
      const lines: string[] = [];
      // Export filters
      lines.push(["Bộ lọc đã áp dụng", ""].map(safeSpreadsheetCell).join(","));
      filterSummary(filters).forEach(row => {
        lines.push(row.map(safeSpreadsheetCell).join(","));
      });
      lines.push("");

      allDatasets.forEach((dataset, idx) => {
        if (idx > 0) lines.push("");
        if (dataset.title) lines.push([`--- ${dataset.title} ---`].map(safeSpreadsheetCell).join(","));
        lines.push(dataset.headers.map(safeSpreadsheetCell).join(","));
        dataset.rows.forEach(row => {
          lines.push(row.map(safeSpreadsheetCell).join(","));
        });
      });
      downloadBlob(new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${filenameBase}.csv`);
    } else {
      let ExcelJS: any;
      try {
        const ExcelJSModule = await import("exceljs");
        ExcelJS = ExcelJSModule.default || ExcelJSModule;
      } catch (e) {
        // Ignored, fallback to CDN
      }

      if (!ExcelJS || typeof ExcelJS.Workbook !== "function") {
        if ((window as any).ExcelJS?.Workbook) {
          ExcelJS = (window as any).ExcelJS;
        } else {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          ExcelJS = (window as any).ExcelJS;
          if (!ExcelJS || typeof ExcelJS.Workbook !== "function") {
            throw new Error("Không thể khởi tạo ExcelJS kể cả bằng CDN.");
          }
        }
      }

      const workbook = new ExcelJS.Workbook();
      
      if (allDatasets.length === 1) {
        const worksheet = workbook.addWorksheet("Dữ liệu");
        worksheet.addRows(exportRows(allDatasets[0], filters).map((row) => row.map(safeWorkbookCell)));
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(filterSummary(filters).length + 3).font = { bold: true };
      } else {
        allDatasets.forEach((dataset, idx) => {
          const rawTitle = dataset.title || `Sheet ${idx + 1}`;
          let sheetName = rawTitle.replace(/[\\/*?:\[\]]/g, "").trim().substring(0, 31);
          if (!sheetName) sheetName = `Sheet ${idx + 1}`;
          let finalSheetName = sheetName;
          let suffix = 1;
          while (workbook.getWorksheet(finalSheetName)) {
            const numStr = ` (${suffix})`;
            finalSheetName = sheetName.substring(0, 31 - numStr.length) + numStr;
            suffix++;
          }
          
          const worksheet = workbook.addWorksheet(finalSheetName);
          worksheet.addRows(exportRows(dataset, filters).map((row) => row.map(safeWorkbookCell)));
          worksheet.getRow(1).font = { bold: true };
          worksheet.getRow(filterSummary(filters).length + 3).font = { bold: true };
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `${filenameBase}.xlsx`,
      );
    }
    return { rowCount: allDatasets.reduce((acc, d) => acc + d.rows.length, 0), hasTable: true };
  }

  const canvas = await renderSnapshot(target, filters);
  if (format === "png") {
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filenameBase}.png`;
    link.click();
    return { rowCount: 1, hasTable: false };
  }

  let jsPDF: any;
  try {
    const mod = await import("jspdf");
    jsPDF = mod.jsPDF || mod.default?.jsPDF || mod.default || mod;
  } catch (e) {
    // Ignored, will use CDN
  }

  if (typeof jsPDF !== "function") {
    if (typeof (window as any).jspdf?.jsPDF === "function") {
      jsPDF = (window as any).jspdf.jsPDF;
    } else {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      jsPDF = (window as any).jspdf?.jsPDF;
      if (typeof jsPDF !== "function") {
        throw new Error("Không thể tải thư viện jsPDF kể cả bằng CDN.");
      }
    }
  }

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
