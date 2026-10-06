/** File size label; "< 1 MB" below 1 MB */
export const formatFileSize = (mb: number) => (mb >= 1 ? `${mb.toLocaleString()} MB` : "< 1 MB")

/**
 * Downloads a file from the station backend. Endpoints that are not ready (501) or fail
 * reject with the server's message so the caller can show it.
 */
export async function downloadFile(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? res.statusText)
  }
  const blob = await res.blob()
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = res.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "model.zip"
  a.click()
  URL.revokeObjectURL(a.href)
}
