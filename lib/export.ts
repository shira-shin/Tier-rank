import { saveAs } from "file-saver";
import * as htmlToImage from "html-to-image";
import { jsPDF } from "jspdf";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import type { ReportSummary } from "@/lib/report";

export function exportJSON(obj: any, filename = "result.json") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  saveAs(blob, filename);
}

export function exportCSV(rows: any[], filename = "result.csv") {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  saveAs(blob, filename);
}

// 対象DOMをPNG保存（可視領域）
export async function exportPNG(node: HTMLElement, filename = "result.png") {
  const dataUrl = await htmlToImage.toPng(node, { cacheBust: true, pixelRatio: 2 });
  saveAs(dataUrl, filename);
}

export async function exportReportPDF(node: HTMLElement, filename = "report.pdf") {
  const dataUrl = await htmlToImage.toPng(node, { cacheBust: true, pixelRatio: 2 });
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const imgProps = pdf.getImageProperties(dataUrl);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}

export async function exportReportDocx(summary: ReportSummary, filename = "report.docx") {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: summary.title, heading: HeadingLevel.TITLE }),
          new Paragraph({ text: summary.subtitle }),
          ...summary.sections.flatMap((section) => [
            new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }),
            ...section.paragraphs.map(
              (text) =>
                new Paragraph({
                  text,
                  bullet: { level: 0 },
                }),
            ),
          ]),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
