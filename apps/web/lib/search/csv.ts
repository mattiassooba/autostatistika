// CSV of search variants: semicolon-separated UTF-8 with a byte-order mark, so
// Estonian Excel (comma decimals, semicolon lists) opens it as columns.
// Missing values stay empty, never 0.

import type { Variant } from "./engine";

export type CsvColumn = { header: string; value: (variant: Variant) => string | number | null };

function cell(value: string | number | null): string {
  if (value == null) return "";
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function variantsCsv(variants: Variant[], columns: CsvColumn[]): string {
  const lines = [columns.map((column) => cell(column.header)).join(";")];
  for (const variant of variants) lines.push(columns.map((column) => cell(column.value(variant))).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
