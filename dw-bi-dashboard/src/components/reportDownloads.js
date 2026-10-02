function getReportBlocks(content) {
  return content
    .split(/\r?\n/)
    .map((rawLine) => rawLine.trim())
    .filter(Boolean)
    .filter((line) => !/^\|?\s*:?-{2,}/.test(line))
    .map((line) => {
      const heading = line.match(/^#{1,6}\s+(.+)|^\*\*(.+?)\*\*\s*:?$/);
      if (heading) {
        return { type: "heading", text: (heading[1] || heading[2]).replace(/[*_`]/g, "").trim() };
      }

      const tableLine = line.startsWith("|") && line.endsWith("|");
      const text = tableLine
        ? line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()).join("  •  ")
        : line.replace(/^\s*[-*•]\s+/, "• ").replace(/^\s*\d+[.)]\s+/, "• ");
      return {
        type: /^[•]\s/.test(text) ? "bullet" : "body",
        text: text.replace(/\*\*/g, "").replace(/[`*_]/g, "").trim(),
      };
    })
    .filter((block) => block.text);
}

function reportFilename(extension) {
  return `datawise-report-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function pdfSafeText(text) {
  return text
    .replace(/[•]/g, "-")
    .replace(/[→]/g, "->")
    .replace(/[✦✓]/g, "*")
    .replace(/[–—]/g, "-");
}

export function getReportChartMetrics(analysis, metricNames = [], content = "") {
  const totals = analysis?.totals || {};
  const definitions = [
    { metric: /revenue|income/i, field: /revenue|sales|income|amount/i },
    { metric: /customer|user/i, field: /customer|user|client|email/i },
    { metric: /operation|project|task/i, field: /operation|project|task|order|record/i },
    { metric: /inventory|asset/i, field: /inventory|asset|stock|quantity|unit/i },
    { metric: /marketing/i, field: /marketing|campaign|click|conversion|lead|impression/i },
    { metric: /quality|compliance/i, field: /quality|compliance|status|validated/i },
    { metric: /team performance/i, field: /performance|productivity|score|team/i },
  ];
  const selectedMetrics = metricNames.length ? metricNames : definitions.map((item) => item.metric.source);
  const result = [];
  selectedMetrics.forEach((metricName) => {
    const definition = definitions.find((item) => item.metric.test(metricName));
    const match = Object.entries(totals).find(([field, value]) => (
      definition?.field.test(field) && Number.isFinite(Number(value))
    ));
    if (match) {
      result.push({ label: match[0], value: Number(match[1]) });
      return;
    }
    if (/customer|user/i.test(metricName) && Array.isArray(analysis?.rows)) {
      const column = (analysis.columns || Object.keys(analysis.rows[0] || {}))
        .find((field) => /customer|user|client|email/i.test(field));
      if (column) {
        const uniqueCount = new Set(analysis.rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean)).size;
        result.push({ label: `${metricName} (unique)`, value: uniqueCount });
      }
    }
  });

  if (metricNames.length) return result.slice(0, 6);
  if (result.length) return result.slice(0, 6);
  const numericTotals = Object.entries(totals)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .map(([label, value]) => ({ label, value: Number(value) }))
    .slice(0, 6);
  if (numericTotals.length) return numericTotals;

  return content.split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*•]\s*)?([^:|]{2,32})\s*[:|—-]\s*[$₹]?([\d,]+(?:\.\d+)?%?)/))
    .filter(Boolean)
    .slice(0, 6)
    .map((match) => ({ label: match[1].trim(), value: Number(match[2].replace(/[,%]/g, "")) }));
}

export async function downloadReportAsPdf(content, analysis, metricNames = []) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const chartMetrics = getReportChartMetrics(analysis, metricNames, content);
  let y = 208;

  pdf.setFillColor(16, 32, 68);
  pdf.rect(0, 0, pageWidth, 180, "F");
  pdf.setFillColor(55, 214, 162);
  pdf.rect(0, 0, pageWidth, 7, "F");
  pdf.setTextColor(158, 184, 245);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("DATAWISE  /  EXECUTIVE REPORT", margin, 48);
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(25);
  pdf.text("Executive data brief", margin, 91);
  pdf.setTextColor(198, 211, 236);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("AI-generated insights, performance signals and recommended next steps", margin, 119);
  pdf.setFontSize(9);
  pdf.text(`Generated ${new Date().toLocaleDateString()}`, margin, 151);

  if (chartMetrics.length) {
    pdf.setTextColor(53, 104, 231);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("PERFORMANCE SNAPSHOT", margin, y);
    y += 24;
    const gap = 10;
    const columns = Math.min(chartMetrics.length, 3);
    const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
    const rows = Math.ceil(chartMetrics.length / columns);
    chartMetrics.forEach((item, index) => {
      const x = margin + (index % columns) * (cardWidth + gap);
      const top = y + Math.floor(index / columns) * 59;
      const palette = [[237, 243, 255], [232, 249, 243], [244, 238, 255]];
      pdf.setFillColor(...palette[index % palette.length]);
      pdf.roundedRect(x, top, cardWidth, 50, 5, 5, "F");
      pdf.setTextColor(83, 98, 125);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(pdf.splitTextToSize(item.label, cardWidth - 18).slice(0, 1), x + 9, top + 15);
      pdf.setTextColor(31, 47, 77);
      pdf.setFontSize(15);
      pdf.text(Number(item.value).toLocaleString(), x + 9, top + 37);
    });
    y += rows * 59 + 10;
    pdf.setTextColor(31, 47, 77);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Selected workspace metrics", margin, y);
    y += 16;
    const maxValue = Math.max(1, ...chartMetrics.map((item) => Math.abs(Number(item.value) || 0)));
    chartMetrics.forEach((item, index) => {
      const barY = y + index * 25;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(64, 80, 108);
      pdf.text(pdf.splitTextToSize(item.label, 120).slice(0, 1), margin, barY + 9);
      pdf.setFillColor(232, 237, 246);
      pdf.roundedRect(margin + 126, barY, contentWidth - 210, 10, 4, 4, "F");
      pdf.setFillColor(...[[53, 104, 231], [53, 184, 133], [135, 91, 232], [242, 160, 68]][index % 4]);
      pdf.roundedRect(margin + 126, barY, Math.max(3, (contentWidth - 210) * Math.abs(Number(item.value) || 0) / maxValue), 10, 4, 4, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(38, 54, 83);
      pdf.text(Number(item.value).toLocaleString(), pageWidth - margin, barY + 9, { align: "right" });
    });
    y += chartMetrics.length * 25 + 22;
  }

  const ensureSpace = (height) => {
    if (y + height > pageHeight - 54) {
      pdf.addPage();
      y = margin;
    }
  };
  getReportBlocks(content).forEach(({ type, text }) => {
    const isHeading = type === "heading";
    const fontSize = isHeading ? 13 : 9;
    const lineHeight = isHeading ? 18 : 14;
    const indent = type === "bullet" ? 14 : 0;
    pdf.setFont("helvetica", isHeading || type === "bullet" ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(pdfSafeText(text), contentWidth - indent - 12);
    const requiredHeight = lines.length * lineHeight + (isHeading ? 14 : 8);
    ensureSpace(requiredHeight);
    if (isHeading) {
      pdf.setFillColor(237, 243, 255);
      pdf.roundedRect(margin, y - 11, contentWidth, 23, 4, 4, "F");
      pdf.setTextColor(42, 79, 155);
      pdf.text(lines, margin + 9, y + 4);
    } else {
      pdf.setTextColor(58, 70, 91);
      pdf.text(lines, margin + indent, y);
    }
    y += requiredHeight;
  });
  const pageCount = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(225, 232, 242);
    pdf.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(132, 145, 167);
    pdf.text("CONFIDENTIAL  ·  DATAWISE BI", margin, pageHeight - 20);
    pdf.text(`${page} / ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: "right" });
  }
  pdf.save(reportFilename("pdf"));
}

export async function downloadReportAsDocx(content, analysis, metricNames = []) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun, Footer, AlignmentType } = await import("docx");
  const chartMetrics = getReportChartMetrics(analysis, metricNames, content);
  const children = [
    new Paragraph({
      children: [new TextRun({ text: "DATAWISE  /  EXECUTIVE REPORT", bold: true, color: "3568E7", size: 20 })],
      spacing: { after: 220 },
      border: { bottom: { color: "37D6A2", space: 8, style: "single", size: 16 } },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Executive data brief", bold: true, color: "102044", size: 42 })],
      heading: HeadingLevel.TITLE,
      spacing: { before: 120, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated ${new Date().toLocaleDateString()}  ·  Confidential`, color: "78869D", size: 18 })],
      spacing: { after: 320 },
    }),
  ];
  if (chartMetrics.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: "PERFORMANCE SNAPSHOT", bold: true, color: "3568E7", size: 20 })],
      spacing: { before: 120, after: 100 },
    }));
    chartMetrics.forEach((item, index) => children.push(new Paragraph({
      children: [
        new TextRun({ text: `${item.label}   `, bold: true, color: ["3568E7", "279A70", "7046C2"][index % 3], size: 22 }),
        new TextRun({ text: Number(item.value).toLocaleString(), bold: true, color: "1F2F4D", size: 24 }),
      ],
      shading: { fill: ["EDF3FF", "E8F9F3", "F4EEFF"][index % 3] },
      spacing: { before: 80, after: 100 },
    })));
    children.push(new Paragraph({
      children: [new TextRun({ text: "Metric comparison (relative scale)", bold: true, color: "1F2F4D", size: 22 })],
      spacing: { before: 220, after: 100 },
    }));
    const maximum = Math.max(1, ...chartMetrics.map((item) => Math.abs(Number(item.value) || 0)));
    chartMetrics.forEach((item) => {
      const bars = Math.max(1, Math.round(Math.abs(Number(item.value) || 0) / maximum * 20));
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${item.label}: `, bold: true, color: "40506C" }),
          new TextRun({ text: "■".repeat(bars), bold: true, color: "3568E7" }),
          new TextRun({ text: `  ${Number(item.value).toLocaleString()}`, bold: true, color: "1F2F4D" }),
        ],
        spacing: { after: 80 },
      }));
    });
    children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
  }
  getReportBlocks(content).forEach(({ type, text }) => {
    if (type === "heading") {
      children.push(new Paragraph({
        children: [new TextRun({ text, bold: true, color: "294F9B", size: 24 })],
        heading: HeadingLevel.HEADING_1,
        shading: { fill: "EDF3FF" },
        spacing: { before: 220, after: 100 },
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text, bold: type === "bullet", color: "39465C", size: 20 })],
        ...(type === "bullet" ? { bullet: { level: 0 } } : {}),
        spacing: { after: 100 },
      }));
    }
  });
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Aptos", size: 20, color: "39465C" } } },
    },
    sections: [{
      properties: { page: { margin: { top: 900, right: 960, bottom: 900, left: 960 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "CONFIDENTIAL  ·  DATAWISE BI", color: "8491A7", size: 16 })],
          })],
        }),
      },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const link = window.document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = reportFilename("docx");
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export async function downloadReportAsPptx(content, analysis, metricNames = []) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Datawise BI";
  pptx.subject = "Generated Datawise report";
  pptx.title = "Datawise Executive Report";
  pptx.company = "Datawise";
  pptx.lang = "en-US";

  const blocks = getReportBlocks(content);
  const chunks = [];
  let current = [];
  let height = 0;
  blocks.forEach((block) => {
    const estimatedLines = Math.max(1, Math.ceil(block.text.length / 112));
    const blockHeight = block.type === "heading" ? 0.46 : Math.min(1, 0.38 + estimatedLines * 0.19);
    if ((height + blockHeight > 5 || current.length >= 8) && current.length) {
      chunks.push(current);
      current = [];
      height = 0;
    }
    current.push(block);
    height += blockHeight;
  });
  if (current.length || !chunks.length) chunks.push(current);

  const chartMetrics = getReportChartMetrics(analysis, metricNames, content);
  const totalSlides = 1 + (chartMetrics.length ? 1 : 0) + chunks.length;
  const firstContentSlide = (chartMetrics.length ? 2 : 1) + 1;
  const cover = pptx.addSlide();
  cover.background = { color: "102044" };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.16, line: { color: "37D6A2", transparency: 100 }, fill: { color: "37D6A2" } });
  cover.addText("DATAWISE  /  EXECUTIVE REPORT", {
    x: 0.75, y: 0.7, w: 11.8, h: 0.3, fontFace: "Aptos", fontSize: 10,
    bold: true, color: "9EB8F5", charSpacing: 1.5,
  });
  cover.addText("Executive data brief", {
    x: 0.75, y: 1.45, w: 11.6, h: 0.9, fontFace: "Aptos Display",
    fontSize: 34, bold: true, color: "FFFFFF",
  });
  cover.addText("AI-generated insights, performance signals and recommended next steps", {
    x: 0.78, y: 2.5, w: 10.8, h: 0.45, fontFace: "Aptos",
    fontSize: 15, color: "C3D0E8",
  });
  cover.addShape(pptx.ShapeType.roundRect, { x: 0.78, y: 3.55, w: 2.15, h: 0.52, rectRadius: 0.08, line: { color: "3265E8", transparency: 100 }, fill: { color: "3265E8" } });
  cover.addText(new Date().toLocaleDateString(), { x: 0.9, y: 3.7, w: 1.9, h: 0.18, fontFace: "Aptos", fontSize: 11, bold: true, color: "FFFFFF", align: "center" });
  cover.addText("CONFIDENTIAL  ·  DATAWISE BI", { x: 0.78, y: 6.9, w: 6, h: 0.2, fontFace: "Aptos", fontSize: 8, bold: true, color: "8293B2", charSpacing: 1 });
  cover.addText(`1 / ${totalSlides}`, { x: 11.8, y: 7.1, w: 0.8, h: 0.2, align: "right", fontFace: "Aptos", fontSize: 8, color: "8293B2" });

  if (chartMetrics.length) {
    const chartSlide = pptx.addSlide();
    chartSlide.background = { color: "F7F9FC" };
    chartSlide.addText("PERFORMANCE SNAPSHOT", {
      x: 0.65, y: 0.42, w: 12, h: 0.25, fontFace: "Aptos", fontSize: 9,
      bold: true, color: "3568E7", charSpacing: 1.2,
    });
    chartSlide.addText("Selected workspace metrics", {
      x: 0.65, y: 0.82, w: 12, h: 0.5, fontFace: "Aptos Display",
      fontSize: 24, bold: true, color: "1F2F4D",
    });
    chartSlide.addText("Relative index · highest selected value = 100", {
      x: 0.68, y: 1.3, w: 11.8, h: 0.18, fontFace: "Aptos", fontSize: 8, color: "8491A7",
    });
    const maxMetricValue = Math.max(1, ...chartMetrics.map((item) => Math.abs(Number(item.value) || 0)));
    chartSlide.addChart(pptx.ChartType.bar, [{
      name: "Relative metric index",
      labels: chartMetrics.map((item) => item.label),
      values: chartMetrics.map((item) => Math.round(Math.abs(Number(item.value) || 0) / maxMetricValue * 100)),
    }], {
      x: 0.72, y: 1.55, w: 11.9, h: chartMetrics.length > 4 ? 3.95 : 4.35,
      catAxisLabelFontFace: "Aptos",
      catAxisLabelFontSize: 12,
      catAxisLabelColor: "40506C",
      valAxisLabelFontFace: "Aptos",
      valAxisLabelFontSize: 9,
      valAxisLabelColor: "7D8AA1",
      valAxisMinVal: 0,
      valAxisMaxVal: 100,
      valAxisMajorUnit: 25,
      valGridLine: { color: "E3EAF4", width: 1 },
      chartColors: ["3568E7", "35B885", "875BE8", "F2A044", "22A9B7", "E7687C"],
      varyColors: true,
      showLegend: false,
      showTitle: false,
      showValue: true,
      showCatName: false,
      showValAxisTitle: false,
      showCatAxisTitle: false,
      dataLabelPosition: "outEnd",
      dataLabelColor: "263653",
      dataLabelFormatCode: '0"%"',
      showBorder: false,
    });
    const cardGap = 0.12;
    const cardWidth = (11.9 - cardGap * (chartMetrics.length - 1)) / chartMetrics.length;
    chartMetrics.forEach((item, index) => {
      const x = 0.72 + index * (cardWidth + cardGap);
      chartSlide.addShape(pptx.ShapeType.roundRect, {
        x, y: 5.82, w: cardWidth, h: 0.76, rectRadius: 0.06,
        line: { color: "E3EAF4", width: 0.7 }, fill: { color: ["EDF3FF", "E8F9F3", "F4EEFF", "FFF4E7"][index % 4] },
      });
      chartSlide.addText(item.label, {
        x: x + 0.12, y: 5.94, w: cardWidth - 0.24, h: 0.16,
        fontFace: "Aptos", fontSize: 8, bold: true, color: "66758F",
        fit: "shrink", breakLine: false,
      });
      chartSlide.addText(Number(item.value).toLocaleString(), {
        x: x + 0.12, y: 6.18, w: cardWidth - 0.24, h: 0.23,
        fontFace: "Aptos Display", fontSize: 15, bold: true, color: "1F2F4D",
        fit: "shrink",
      });
    });
    chartSlide.addText("Calculated from the selected workspace metrics and uploaded dataset.", {
      x: 0.75, y: 6.72, w: 10.8, h: 0.2, fontFace: "Aptos", fontSize: 8, color: "8491A7",
    });
    chartSlide.addText(`2 / ${totalSlides}`, { x: 11.8, y: 6.72, w: 0.8, h: 0.2, align: "right", fontFace: "Aptos", fontSize: 8, color: "8491A7" });
  }

  chunks.forEach((chunk, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: "F7F9FC" };
    slide.addText("DATAWISE  /  EXECUTIVE REPORT", {
      x: 0.55, y: 0.35, w: 12.2, h: 0.25, fontFace: "Aptos", fontSize: 9,
      bold: true, color: "3568E7", charSpacing: 1.4,
    });
    slide.addText(index === 0 ? "Key findings & recommendations" : "Continued insights", {
      x: 0.55, y: 0.77, w: 12.2, h: 0.43, fontFace: "Aptos Display",
      fontSize: 23, bold: true, color: "1F2F4D",
    });
    let y = 1.45;
    chunk.forEach((block, blockIndex) => {
      const isHeading = block.type === "heading";
      const estimatedLines = Math.max(1, Math.ceil(block.text.length / 112));
      const height = isHeading ? 0.48 : Math.min(0.88, 0.26 + estimatedLines * 0.19);
      if (isHeading) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.62, y, w: 12.05, h: 0.38, rectRadius: 0.04,
          line: { color: "E6EDFB", transparency: 100 }, fill: { color: "EAF0FF" },
        });
        slide.addText(block.text.toUpperCase(), {
          x: 0.82, y: y + 0.1, w: 11.6, h: 0.18,
          fontFace: "Aptos", fontSize: 10, bold: true, color: "294F9B",
          charSpacing: 0.6, fit: "shrink",
        });
      } else {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.62, y, w: 12.05, h: height, rectRadius: 0.04,
          line: { color: "E9EDF4", width: 0.6 }, fill: { color: "FFFFFF" },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.62, y, w: 0.07, h: height,
          line: { color: block.type === "bullet" ? "35B885" : "3568E7", transparency: 100 },
          fill: { color: block.type === "bullet" ? "35B885" : "3568E7" },
        });
        slide.addText(block.type === "bullet" ? "•" : `${String(blockIndex + 1).padStart(2, "0")}`, {
          x: 0.84, y: y + 0.12, w: 0.35, h: 0.2,
          fontFace: "Aptos", fontSize: 10, bold: true,
          color: block.type === "bullet" ? "279A70" : "3568E7",
        });
        slide.addText(block.text.replace(/^•\s*/, ""), {
          x: 1.22, y: y + 0.1, w: 11.15, h: height - 0.16,
          fontFace: "Aptos", fontSize: 12, bold: block.type === "bullet",
          color: "40506C", valign: "mid", margin: 0,
          fit: "shrink", breakLine: false,
        });
      }
      y += height + (isHeading ? 0.08 : 0.12);
    });
    slide.addShape(pptx.ShapeType.line, {
      x: 0.62, y: 7.02, w: 12.05, h: 0,
      line: { color: "E2E8F2", width: 0.7 },
    });
    slide.addText("CONFIDENTIAL  ·  DATAWISE BI", {
      x: 0.65, y: 7.12, w: 5, h: 0.16, fontFace: "Aptos",
      fontSize: 8, bold: true, color: "8491A7", charSpacing: 0.8,
    });
    slide.addText(`${firstContentSlide + index} / ${firstContentSlide + chunks.length - 1}`, {
      x: 11.8, y: 7.1, w: 0.8, h: 0.2, align: "right",
      fontFace: "Aptos", fontSize: 8, color: "8C98AA",
    });
  });

  await pptx.writeFile({ fileName: reportFilename("pptx") });
}
