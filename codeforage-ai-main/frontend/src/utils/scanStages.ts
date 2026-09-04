export type StageStatus = "pending" | "running" | "completed" | "failed";

export interface StageState {
  status: StageStatus;
  progress?: number;
  message?: string;
  error?: string;
}

export type ScanStages = Record<string, StageState>;

export interface StageDef {
  key: string;
  label: string;
}

export const STAGE_DEFS: StageDef[] = [
  { key: "clone", label: "Repository Cloned" },
  { key: "index", label: "Dependencies Indexed" },
  { key: "embed", label: "Generating Embeddings" },
  { key: "architecture", label: "Building Architecture Graph" },
  { key: "security", label: "Security Analysis" },
  { key: "health", label: "Health Calculation" },
];

const STAGE_KEYS = new Set(STAGE_DEFS.map((d) => d.key));
const VALID_STATUSES: StageStatus[] = ["pending", "running", "completed", "failed"];

function normalizeStage(raw: any): StageState {
  const status: StageStatus = VALID_STATUSES.includes(raw?.status) ? raw.status : "pending";
  const out: StageState = { status };
  if (typeof raw?.progress === "number") out.progress = raw.progress;
  if (typeof raw?.message === "string" && raw.message) out.message = raw.message;
  if (typeof raw?.error === "string" && raw.error) out.error = raw.error;
  return out;
}

function mergeFromObject(obj: any): ScanStages {
  const merged: ScanStages = {};
  if (!obj || typeof obj !== "object") return merged;
  for (const key of STAGE_KEYS) {
    const raw = obj[key];
    if (raw && typeof raw === "object" && typeof raw.status === "string") {
      merged[key] = normalizeStage(raw);
    }
  }
  return merged;
}

/**
 * Parses the per-stage state persisted by the backend.
 * The backend mirrors the stage JSON into `current_step` (and optionally the
 * `stages` jsonb column). Falls back to legacy status/progress inference for
 * jobs created before stage tracking existed (incl. demo mode).
 */
export function parseStages(job: any): ScanStages {
  if (job) {
    if (job.stages && typeof job.stages === "object" && !Array.isArray(job.stages)) {
      const merged = mergeFromObject(job.stages);
      if (Object.keys(merged).length) return merged;
    }
    const raw = job.current_step;
    if (typeof raw === "string" && raw.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        const merged = mergeFromObject(parsed);
        if (Object.keys(merged).length) return merged;
      } catch {
        // not stage JSON, fall through to legacy inference
      }
    }
  }
  return legacyStages(job?.status, job?.progress);
}

export function legacyStages(status?: string, progress?: number): ScanStages {
  const p = typeof progress === "number" ? progress : 0;
  const id: StageState = { status: "pending" };
  const st: ScanStages = {
    clone: { ...id },
    index: { ...id },
    embed: { ...id },
    architecture: { ...id },
    security: { ...id },
    health: { ...id },
  };

  if (!status || status === "queued" || status === "none") return st;

  if (status === "failed") {
    st.clone = { status: "completed" };
    st.index = { status: "completed" };
    st.embed = { status: "completed" };
    st.architecture = { status: "completed" };
    st.security = { status: "completed" };
    st.health = { status: "completed" };
    return st;
  }

  if (status === "cloning") {
    st.clone = { status: "running" };
    return st;
  }

  if (status === "scanning") {
    st.clone = { status: "completed" };
    st.index = { status: "running" };
    return st;
  }

  if (status === "embedding") {
    st.clone = { status: "completed" };
    st.index = { status: "completed" };
    st.embed = { status: "running", progress: p };
    return st;
  }

  if (status === "analyzing") {
    st.clone = { status: "completed" };
    st.index = { status: "completed" };
    st.embed = { status: "completed" };
    if (p < 80) {
      st.architecture = { status: "running", progress: p };
    } else if (p < 90) {
      st.architecture = { status: "completed" };
      st.security = { status: "running", progress: p };
    } else if (p < 100) {
      st.architecture = { status: "completed" };
      st.security = { status: "completed" };
      st.health = { status: "running", progress: p };
    }
    return st;
  }

  // completed (or anything unknown): all stages done
  for (const key of STAGE_KEYS) {
    st[key] = { status: "completed" };
  }
  return st;
}

export interface StageView {
  text: string;
  tone: "idle" | "run" | "done" | "err";
  progress?: number;
  error?: string;
}

export function stageView(s?: StageState): StageView {
  const status = s?.status || "pending";
  if (status === "completed") return { text: "Complete", tone: "done" };
  if (status === "failed") {
    return { text: "Failed", tone: "err", error: s?.error };
  }
  if (status === "running") {
    const pct = s?.progress != null ? ` ${Math.round(s.progress)}%` : "";
    return { text: `Running${pct}`, tone: "run", progress: s?.progress };
  }
  return { text: "Pending", tone: "idle" };
}