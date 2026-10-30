import { toast } from 'sonner';
export async function runAction(fn: () => unknown, message?: string) {
  try { await fn(); if (message) toast.success(message); } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save'); }
}
export function exportCSV(name: string, rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] ?? {});
  const quote = (v: unknown) => `"${String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  const content = [keys.map(quote).join(','), ...rows.map(row => keys.map(k => quote(row[k])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = `${name}.csv`; link.click(); URL.revokeObjectURL(url);
}
