import type { ConvertPreview } from "@/domain/dataset"

export const PICKER_PAGE = 50

/** The LeRobot info the conversion would write, as a YAML-like preview */
export function previewText(preview: ConvertPreview, instruction: string) {
  return [
    `fps: ${preview.fps}`,
    "features:",
    ...preview.features.map((f) => `  ${f.key}: ${f.dtype} ${f.shape}${f.note ? `  # ${f.note}` : ""}`),
    `task: ${instruction}`,
  ].join("\n")
}
