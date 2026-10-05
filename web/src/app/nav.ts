import type { IconType } from "react-icons"
import {
  LuBox,
  LuBrain,
  LuCable,
  LuClipboardCheck,
  LuCpu,
  LuDatabase,
  LuFlaskConical,
  LuLayoutDashboard,
  LuListChecks,
  LuMerge,
  LuRadioTower,
  LuRepeat,
  LuSlidersHorizontal,
} from "react-icons/lu"

export const APP_NAME = "Mimic"

export type NavItem = {
  to: string
  label: string
  icon: IconType
  /** "rec" while an episode is being captured, "tasks" for the task count (both read live by the sidebar) */
  badge?: "rec" | "tasks"
}
export type NavGroup = { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: "Collect",
    items: [
      { to: "/", label: "Dashboard", icon: LuLayoutDashboard },
      { to: "/rigs", label: "Rigs", icon: LuCable },
      { to: "/tasks", label: "Tasks", icon: LuListChecks, badge: "tasks" },
      { to: "/capture", label: "Capture", icon: LuRadioTower, badge: "rec" },
    ],
  },
  {
    label: "Data",
    items: [
      { to: "/review", label: "Review", icon: LuClipboardCheck },
      { to: "/convert", label: "Convert", icon: LuRepeat },
      { to: "/datasets", label: "Datasets", icon: LuDatabase },
      { to: "/merge", label: "Merge", icon: LuMerge },
    ],
  },
  {
    label: "Train & Evaluate",
    items: [
      { to: "/training", label: "Training", icon: LuCpu },
      { to: "/models", label: "Models", icon: LuBrain },
      { to: "/simulation", label: "Simulation", icon: LuBox },
      { to: "/evaluate", label: "Evaluate", icon: LuFlaskConical },
    ],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: LuSlidersHorizontal }],
  },
]
