import type { McapTopic, Recording } from "@/domain/recording"

const SKIP = "skip"

export const PICKER_PAGE = 50

/** Our own recordings carry rig metadata, so the feature is picked from the topic kind */
function autoFeature(t: McapTopic, rec: Recording): string {
  if (rec.source !== "capture") return SKIP
  switch (t.kind) {
    case "action":
      return "action"
    case "state":
      return "observation.state"
    case "video":
      return `observation.images.${t.name.match(/^\/cam_([^/]+)/)?.[1] ?? "main"}`
    case "label":
      return t.name.endsWith("subtask") ? "subtask_index" : SKIP
    default:
      return SKIP
  }
}

/** Collects one topic per name across recordings and keeps only those mapped to a feature */
export function includedFeatures(recs: Recording[]) {
  const topics = new Map<string, { topic: McapTopic; rec: Recording }>()
  for (const r of recs) for (const t of r.topics) if (!topics.has(t.name)) topics.set(t.name, { topic: t, rec: r })
  // Features are derived automatically from rig info
  return [...topics.values()].map(({ topic, rec }) => ({ topic, feature: autoFeature(topic, rec) })).filter((m) => m.feature !== SKIP)
}
