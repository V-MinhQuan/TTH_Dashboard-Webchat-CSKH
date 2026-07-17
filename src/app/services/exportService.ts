import type { FilterValues } from "../context/GlobalFilterContext";

export type ExportFormat = "pdf" | "png" | "csv" | "xlsx";

interface ExportRequest {
  format: ExportFormat;
  target: HTMLElement;
  filenameBase: string;
  filters: FilterValues;
  rawData?: any;
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

function resolveExportDatasets(target: HTMLElement, rawData?: any): TableData[] {
  if (Array.isArray(rawData)) return rawData;

  const datasets: TableData[] = [];
  if (rawData && (rawData.headers?.length > 0 || rawData.rows?.length > 0)) {
    datasets.push({ title: "Tổng quan", headers: rawData.headers, rows: rawData.rows });
  }
  datasets.push(...collectAllTableData(target));
  return datasets;
}

async function exportStructuredPdf(
  datasets: TableData[],
  filters: FilterValues,
  filename: string,
) {
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
  const vfs = (pdfFontsModule as any).default || pdfFontsModule;
  pdfMake.vfs = vfs;

  const content: any[] = [
    { text: "BÁO CÁO DỮ LIỆU", style: "reportTitle" },
    { text: `Ngày xuất: ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`, style: "meta" },
    { text: "Bộ lọc đã áp dụng", style: "sectionTitle", margin: [0, 10, 0, 4] },
  ];

  const appliedFilters = filterSummary(filters);
  content.push(appliedFilters.length
    ? {
        table: {
          widths: [110, "*"],
          body: appliedFilters.map(([label, value]) => [
            { text: label, bold: true, fillColor: "#EAF2F8" },
            String(value),
          ]),
        },
        layout: "lightHorizontalLines",
      }
    : { text: "Không có bộ lọc bổ sung.", italics: true, color: "#64748B" });

  datasets.forEach((dataset, index) => {
    const headers = dataset.headers.map((header) => ({
      text: String(header ?? ""),
      bold: true,
      color: "#FFFFFF",
      fillColor: "#003865",
    }));
    const columnCount = Math.max(headers.length, ...dataset.rows.map((row) => row.length), 1);
    const normalizedHeaders = Array.from({ length: columnCount }, (_, columnIndex) => (
      headers[columnIndex] || { text: "", bold: true, color: "#FFFFFF", fillColor: "#003865" }
    ));
    const body = [
      normalizedHeaders,
      ...dataset.rows.map((row, rowIndex) => Array.from({ length: columnCount }, (_, columnIndex) => ({
        text: String(row[columnIndex] ?? ""),
        fillColor: rowIndex % 2 ? "#F8FAFC" : "#FFFFFF",
      }))),
    ];

    content.push(
      { text: dataset.title || `Bảng dữ liệu ${index + 1}`, style: "sectionTitle", pageBreak: index > 0 ? "before" : undefined },
      {
        table: { headerRows: 1, widths: Array(columnCount).fill("*"), body },
        layout: {
          hLineColor: () => "#CBD5E1",
          vLineColor: () => "#CBD5E1",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    );
  });

  const documentDefinition: any = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 32, 28, 32],
    content,
    defaultStyle: { font: "Roboto", fontSize: 7.5, color: "#0F172A" },
    styles: {
      reportTitle: { fontSize: 17, bold: true, color: "#003865" },
      sectionTitle: { fontSize: 11, bold: true, color: "#003865", margin: [0, 14, 0, 6] },
      meta: { fontSize: 8, color: "#64748B", margin: [0, 3, 0, 0] },
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Trang ${currentPage}/${pageCount}`,
      alignment: "right",
      margin: [0, 8, 28, 0],
      fontSize: 7,
      color: "#64748B",
    }),
  };

  await new Promise<void>((resolve, reject) => {
    try {
      pdfMake.createPdf(documentDefinition).download(filename, resolve);
    } catch (error) {
      reject(error);
    }
  });
}

function safeSpreadsheetCell(value: any) {
  const strValue = String(value ?? "");
  const safe = /^[=+@-]/.test(strValue.trimStart()) ? `'${strValue}` : strValue;
  return `"${safe.replace(/"/g, '""')}"`;
}

function safeWorkbookCell(value: any) {
  const strValue = String(value ?? "");
  return /^[=+@-]/.test(strValue.trimStart()) ? `'${strValue}` : strValue;
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
    const allDatasets = resolveExportDatasets(target, rawData);

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
      
      const formatWorksheet = (worksheet: any, dataset: TableData) => {
        const headerRowIndex = filterSummary(filters).length + 3;
        
        // Format filter section
        worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: "FF003865" } };
        for (let i = 2; i <= headerRowIndex - 2; i++) {
          worksheet.getCell(`A${i}`).font = { bold: true };
        }

        // Format table header
        const headerRow = worksheet.getRow(headerRowIndex);
        headerRow.eachCell((cell: any) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003865" } };
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } }
          };
        });

        // Format table data
        for (let r = headerRowIndex + 1; r <= headerRowIndex + dataset.rows.length; r++) {
          const row = worksheet.getRow(r);
          const isEven = (r - headerRowIndex) % 2 === 0;
          row.eachCell((cell: any) => {
            cell.alignment = { vertical: "middle", wrapText: true };
            cell.border = {
              top: { style: "thin", color: { argb: "FFCBD5E1" } },
              left: { style: "thin", color: { argb: "FFCBD5E1" } },
              bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
              right: { style: "thin", color: { argb: "FFCBD5E1" } }
            };
            if (isEven) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
            }
          });
        }

        // Auto-fit columns roughly
        worksheet.columns.forEach((column: any, i: number) => {
          let maxLength = 10;
          worksheet.getColumn(i + 1).eachCell({ includeEmpty: true }, (cell: any, rowNumber: number) => {
            if (rowNumber >= headerRowIndex) {
              const columnLength = cell.value ? cell.value.toString().length : 0;
              if (columnLength > maxLength) {
                maxLength = columnLength;
              }
            }
          });
          column.width = Math.min(maxLength + 2, 50); // Cap width at 50
        });
      };

      if (allDatasets.length === 1) {
        const worksheet = workbook.addWorksheet("Dữ liệu");
        worksheet.addRows(exportRows(allDatasets[0], filters).map((row) => row.map(safeWorkbookCell)));
        formatWorksheet(worksheet, allDatasets[0]);
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
          formatWorksheet(worksheet, dataset);
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

  if (format === "pdf") {
    const datasets = resolveExportDatasets(target, rawData);
    if (!datasets.length) return { rowCount: 0, hasTable: false };
    await exportStructuredPdf(datasets, filters, `${filenameBase}.pdf`);
    return { rowCount: datasets.reduce((total, dataset) => total + dataset.rows.length, 0), hasTable: true };
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

  return { rowCount: 1, hasTable: false };
}
