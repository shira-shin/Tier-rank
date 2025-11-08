import { saveAs } from "file-saver";
import * as htmlToImage from "html-to-image";

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
