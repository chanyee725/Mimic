import { LuBell, LuCable, LuCpu, LuHardDrive, LuInfo, LuKeyboard, LuPlug, LuRadioTower, LuWarehouse } from "react-icons/lu"
import type { IconType } from "react-icons"

import { AboutSection } from "./components/about-section"
import { ConnectionSection } from "./components/connection-section"
import { IntegrationsSection } from "./components/integrations-section"
import { NotificationsSection } from "./components/notifications-section"
import { RecordingSection } from "./components/recording-section"
import { ShortcutsSection } from "./components/shortcuts-section"
import { StationSection } from "./components/station-section"
import { StorageSection } from "./components/storage-section"
import { TrainingSection } from "./components/training-section"

type Section = { id: string; label: string; icon: IconType; description: string; render: () => React.ReactNode }

/** Settings sections, in left-nav order */
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
    id: "recording",
    label: "Recording",
    icon: LuRadioTower,
    description: "녹화 기본값과 LeRobot 변환 설정입니다.",
    render: () => <RecordingSection />,
  },
  { id: "training", label: "Training", icon: LuCpu, description: "학습 · 시뮬레이션 기본값입니다.", render: () => <TrainingSection /> },
  {
    id: "notifications",
    label: "Notifications",
    icon: LuBell,
    description: "학습 · pod · 디스크 알림을 Slack 으로 받습니다.",
    render: () => <NotificationsSection />,
  },
  {
    id: "station",
    label: "Station",
    icon: LuWarehouse,
    description: "스테이션 정보와 작업자 ID 입니다.",
    render: () => <StationSection />,
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
