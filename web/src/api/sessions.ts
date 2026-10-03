// Capture sessions (newest first) — docs/api/tasks.md
import { useQuery } from "@tanstack/react-query"

import type { Session } from "@/domain/session"

import { api } from "./client"
import { qk } from "./query"

export const useSessions = (taskId?: string) =>
  useQuery({ queryKey: [...qk.sessions, taskId ?? null], queryFn: () => api.get<Session[]>("/sessions", { taskId }) })
