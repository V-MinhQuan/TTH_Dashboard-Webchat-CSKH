function safeFilename(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "chart"
  );
}

async function captureChart(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Không tìm thấy vùng biểu đồ để xuất file.");
  const { default: html2canvas } = await import("html2canvas");
  const bounds = element.getBoundingClientRect();
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${Math.ceil(bounds.width)}px`,
    height: `${Math.ceil(bounds.height)}px`,
    border: "0",
    visibility: "hidden",
  });
  document.body.appendChild(iframe);

  try {
    const isolatedDocument = iframe.contentDocument;
    if (!isolatedDocument) throw new Error("Không thể khởi tạo vùng xuất biểu đồ.");
    isolatedDocument.open();
    isolatedDocument.write(
      '<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Inter,Arial,sans-serif;color:#003865}</style></head><body></body></html>',
    );
    isolatedDocument.close();
    const clonedChart = element.cloneNode(true) as HTMLElement;
    clonedChart.style.width = `${Math.ceil(bounds.width)}px`;
    clonedChart.style.height = `${Math.ceil(bounds.height)}px`;
    isolatedDocument.body.appendChild(clonedChart);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return await html2canvas(clonedChart, {
      backgroundColor: "#ffffff",
      scale: Math.min(2, window.devicePixelRatio || 1.5),
      useCORS: true,
      logging: false,
    });
  } finally {
    iframe.remove();
  }
}

export async function exportChartAsPng(elementId: string, filename: string) {
  const canvas = await captureChart(elementId);
  const link = document.createElement("a");
  link.download = `${safeFilename(filename)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function exportChartAsPdf(elementId: string, filename: string) {
  const canvas = await captureChart(elementId);
  const { jsPDF } = await import("jspdf");
  const landscape = canvas.width >= canvas.height;
  const pdf = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  pdf.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    (pageWidth - width) / 2,
    (pageHeight - height) / 2,
    width,
    height,
    undefined,
    "FAST",
  );
  pdf.save(`${safeFilename(filename)}.pdf`);
}
