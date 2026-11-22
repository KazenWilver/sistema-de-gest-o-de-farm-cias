export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** Evita injecção de fórmulas ao abrir o CSV numa folha de cálculo. */
function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCell(value: string, delimiter: string): string {
  const safe = sanitizeCell(value);
  return /["\n\r]/.test(safe) || safe.includes(delimiter) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV com ";" (padrão das folhas de cálculo em português) e números com vírgula decimal. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], delimiter = ';'): string {
  const lines = [columns.map((c) => escapeCell(c.header, delimiter)).join(delimiter)];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const v = c.value(row);
          if (v === null || v === undefined) return '';
          if (typeof v === 'number') return String(v).replace('.', ',');
          return escapeCell(v, delimiter);
        })
        .join(delimiter),
    );
  }
  return lines.join('\r\n');
}

export function downloadCsv(fileName: string, csv: string): void {
  // BOM para o Excel reconhecer UTF-8 (acentos).
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
