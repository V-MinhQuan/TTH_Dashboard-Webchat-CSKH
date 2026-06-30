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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Không thể tạo file ảnh từ biểu đồ."));
    }, "image/png");
  });
}

function relativeRect(element: Element, rootBounds: DOMRect) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left - rootBounds.left,
    y: rect.top - rootBounds.top,
    width: rect.width,
    height: rect.height,
  };
}

function applyTextStyle(context: CanvasRenderingContext2D, element: Element, fallback: string) {
  const styles = window.getComputedStyle(element);
  context.font = styles.font || fallback;
  context.fillStyle = styles.color || "#003865";
}

async function drawSvg(
  context: CanvasRenderingContext2D,
  svg: SVGSVGElement,
  rootBounds: DOMRect,
) {
  const rect = relativeRect(svg, rootBounds);
  if (rect.width < 1 || rect.height < 1) return;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", `${Math.ceil(rect.width)}`);
  clone.setAttribute("height", `${Math.ceil(rect.height)}`);
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${Math.ceil(rect.width)} ${Math.ceil(rect.height)}`);
  }

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = [
    "text{font-family:Inter,Arial,sans-serif;}",
    ".recharts-cartesian-axis-tick-value{fill:#64748b;font-size:12px;}",
    ".recharts-label{fill:#334155;font-size:12px;}",
  ].join("");
  clone.insertBefore(style, clone.firstChild);

  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Không thể tạo ảnh biểu đồ từ SVG."));
    });
    image.src = url;
    await loaded;
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawTextElement(
  context: CanvasRenderingContext2D,
  element: HTMLElement,
  rootBounds: DOMRect,
  fallbackFont: string,
) {
  const text = element.innerText.trim();
  if (!text) return;
  const rect = relativeRect(element, rootBounds);
  applyTextStyle(context, element, fallbackFont);
  context.textBaseline = "top";
  context.fillText(text, rect.x, rect.y);
}

function drawLegendItems(
  context: CanvasRenderingContext2D,
  root: HTMLElement,
  rootBounds: DOMRect,
) {
  const items = Array.from(root.querySelectorAll<HTMLElement>("li")).filter((item) =>
    item.innerText.trim(),
  );
  for (const item of items) {
    const rect = relativeRect(item, rootBounds);
    const colorElement = item.querySelector<SVGElement>("[stroke], [fill]");
    const color =
      colorElement?.getAttribute("stroke") ||
      colorElement?.getAttribute("fill") ||
      "#ED5206";
    const dotY = rect.y + Math.max(6, Math.min(rect.height / 2, 12));
    context.fillStyle = color;
    context.beginPath();
    context.arc(rect.x + 6, dotY, 4, 0, Math.PI * 2);
    context.fill();
    applyTextStyle(context, item, "12px Inter, Arial, sans-serif");
    context.textBaseline = "middle";
    context.fillText(item.innerText.trim(), rect.x + 16, dotY);
  }
}

async function captureChart(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Không tìm thấy vùng biểu đồ để xuất file.");
  const root = element as HTMLElement;
  const bounds = element.getBoundingClientRect();
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(bounds.height);
  if (width < 1 || height < 1) {
    throw new Error("Vùng biểu đồ chưa sẵn sàng để xuất file.");
  }

  await document.fonts?.ready.catch(() => undefined);
  const scale = Math.min(2, window.devicePixelRatio || 1.5);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không thể khởi tạo canvas xuất biểu đồ.");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const title = root.querySelector<HTMLElement>(".chart-builder-export-title");
  if (title) {
    drawTextElement(context, title, bounds, "600 16px Inter, Arial, sans-serif");
  }

  const svg = root.querySelector<SVGSVGElement>("svg");
  if (!svg) throw new Error("Không tìm thấy biểu đồ SVG để xuất file.");
  await drawSvg(context, svg, bounds);
  drawLegendItems(context, root, bounds);
  return canvas;
}

export async function exportChartAsPng(elementId: string, filename: string) {
  const canvas = await captureChart(elementId);
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, `${safeFilename(filename)}.png`);
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
  const blob = pdf.output("blob");
  downloadBlob(blob, `${safeFilename(filename)}.pdf`);
}
