import { LuBell, LuBox, LuInfo, LuKeyboard, LuPlug } from "react-icons/lu"
import type { IconType } from "react-icons"

import { AboutSection } from "./components/about-section"
import { IntegrationsSection } from "./components/integrations-section"
import { IsaacSection } from "./components/isaac-section"
import { NotificationsSection } from "./components/notifications-section"
import { ShortcutsSection } from "./components/shortcuts-section"

type Section = { id: string; label: string; icon: IconType; render: () => React.ReactNode }

/** Settings sections, in left-nav order; an unknown `?section=` falls back to the first */
export const SECTIONS: Section[] = [
  {
    id: "integrations",
    label: "Integrations",
    icon: LuPlug,
    render: () => <IntegrationsSection />,
  },
  {
    id: "isaac",
    label: "Isaac Sim",
    icon: LuBox,
    render: () => <IsaacSection />,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: LuBell,
    render: () => <NotificationsSection />,
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: LuKeyboard,
    render: () => <ShortcutsSection />,
  },
  {
    id: "about",
    label: "About",
    icon: LuInfo,
    render: () => <AboutSection />,
  },
]

/** Old `?section=` ids that still open their section */
export const SECTION_ALIASES: Record<string, string> = { connection: "isaac" }
