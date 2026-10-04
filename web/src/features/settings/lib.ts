import { ApiError } from "@/api/client"

/** Fields the server owns: PATCH ignores them, so they never count as an edit */
const READ_ONLY = new Set(["state", "latencyMs", "spentThisMonth", "token", "apiKey", "slackWebhook"])

/** Copy of a section without its read-only fields (deep) */
export function editable<T>(value: T): T {
  if (Array.isArray(value)) return value.map(editable) as T
  if (value === null || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k]) => !READ_ONLY.has(k))
      .map(([k, v]) => [k, editable(v)]),
  ) as T
}

/** True when the editable parts of two section values match */
export const sameEdits = (a: unknown, b: unknown) => JSON.stringify(editable(a)) === JSON.stringify(editable(b))

/** Server message plus 422 field errors (`loc` without the leading "body") */
export function errorText(err: Error | null): string | null {
  if (!err) return null
  if (!(err instanceof ApiError)) return err.message
  const errors = err.details.errors
  if (!Array.isArray(errors) || errors.length === 0) return err.message
  const lines = errors.map((e: { loc?: unknown[]; msg?: string }) => {
    const where = (e.loc ?? []).filter((x) => x !== "body").join(".")
    return where ? `${where}: ${e.msg}` : String(e.msg)
  })
  return [err.message, ...lines].join("\n")
}
