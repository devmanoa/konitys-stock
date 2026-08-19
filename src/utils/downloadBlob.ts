/**
 * Déclenche le téléchargement navigateur d'un Blob sous le nom donné.
 * (createObjectURL + <a download> + click + revokeObjectURL)
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
