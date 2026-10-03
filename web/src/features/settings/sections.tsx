import { LuBell, LuCable, LuHardDrive, LuInfo, LuKeyboard, LuPlug } from "react-icons/lu"
import type { IconType } from "react-icons"

import { AboutSection } from "./components/about-section"
import { ConnectionSection } from "./components/connection-section"
import { IntegrationsSection } from "./components/integrations-section"
import { NotificationsSection } from "./components/notifications-section"
import { ShortcutsSection } from "./components/shortcuts-section"
import { StorageSection } from "./components/storage-section"

type Section = { id: string; label: string; icon: IconType; description: string; render: () => React.ReactNode }

/** Settings sections, in left-nav order; an unknown `?section=` falls back to the first */
export const SECTIONS: Section[] = [
  {
    id: "integrations",
    label: "Integrations",
    icon: LuPlug,
    description: "Hugging Face, RunPod, Weights & Biases 계정을 연결합니다.",
    render: () => <IntegrationsSection />,
  },
  {
    id: "storage",
    label: "Storage",
    icon: LuHardDrive,
    description: "녹화 · 데이터셋 · 모델 저장 위치와 정리 규칙입니다.",
    render: () => <StorageSection />,
  },
  {
    id: "connection",
    label: "Connection",
    icon: LuCable,
    description: "백엔드 API, 로봇 데이터, 카메라 영상 연결입니다.",
    render: () => <ConnectionSection />,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: LuBell,
    description: "학습 · pod · 디스크 알림을 Slack 으로 받습니다.",
    render: () => <NotificationsSection />,
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: LuKeyboard,
    description: "Capture · Review · Evaluate 단축키입니다.",
    render: () => <ShortcutsSection />,
  },
  { id: "about", label: "About", icon: LuInfo, description: "앱과 백엔드 버전입니다.", render: () => <AboutSection /> },
]
