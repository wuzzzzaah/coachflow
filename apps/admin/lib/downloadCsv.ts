import { apiFetch } from './api';

export async function downloadCsv(url: string, filename: string) {
  const res = await apiFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download CSV: ${res.statusText}`);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}
