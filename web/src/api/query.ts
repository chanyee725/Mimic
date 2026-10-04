import { QueryClient } from "@tanstack/react-query"

import { ApiError } from "./client"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      // 4xx won't fix itself on retry
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
})

/**
 * Query keys, one root per area. Events invalidate by root (see api/events.ts), so every key
 * of an area starts with its root.
 */
export const qk = {
  station: ["station"] as const,
  tasks: ["tasks"] as const,
  sessions: ["sessions"] as const,
  rigs: ["rigs"] as const,
  devices: ["devices"] as const,
  capture: ["capture"] as const,
  recordings: ["recordings"] as const,
  datasets: ["datasets"] as const,
  convert: ["convert"] as const,
  training: ["training"] as const,
  models: ["models"] as const,
  evaluate: ["evaluate"] as const,
  sim: ["sim"] as const,
  settings: ["settings"] as const,
}
