import { SESSIONS } from "@/dummy/sessions"
import type { Session } from "@/domain/session"

export const listSessions = (): Session[] => SESSIONS
