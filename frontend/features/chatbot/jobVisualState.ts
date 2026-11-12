import type { components } from "@intellideploy/api-client";

type Job = components["schemas"]["JobSnapshot"];

export type JobVisualKind =
  | "greeting"
  | "thinking"
  | "clarifying"
  | "retrieving"
  | "implementing"
  | "building"
  | "validating"
  | "deploying"
  | "verifying_live"
  | "waiting_user"
  | "paused_quota"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "working";

export type JobVisualState = {
  kind: JobVisualKind;
  title: string;
  percentage: null;
  detailItems: string[];
  canCompose: boolean;
  canCancel: boolean;
  canResume: boolean;
};

const runningTitles = {
  clarifying: "正在理解需求",
  retrieving: "正在查找可复用项目",
  implementing: "正在分析并实现需求",
  building: "正在构建应用",
  validating: "正在验证功能",
  deploying: "正在发布应用",
  verifying_live: "正在验证使用入口",
} as const;

const statusStates: Record<
  Exclude<Job["status"], "RUNNING">,
  Omit<JobVisualState, "detailItems">
> = {
  QUEUED: {
    kind: "thinking",
    title: "任务已提交",
    percentage: null,
    canCompose: false,
    canCancel: true,
    canResume: false,
  },
  WAITING_USER: {
    kind: "waiting_user",
    title: "需要你补充一点信息",
    percentage: null,
    canCompose: true,
    canCancel: false,
    canResume: false,
  },
  PAUSED_QUOTA: {
    kind: "paused_quota",
    title: "额度不足，任务已暂停",
    percentage: null,
    canCompose: false,
    canCancel: false,
    canResume: true,
  },
  SUCCEEDED: {
    kind: "succeeded",
    title: "应用已交付",
    percentage: null,
    canCompose: true,
    canCancel: false,
    canResume: false,
  },
  FAILED: {
    kind: "failed",
    title: "本次调整未完成",
    percentage: null,
    canCompose: true,
    canCancel: false,
    canResume: false,
  },
  CANCELLED: {
    kind: "cancelled",
    title: "任务已取消",
    percentage: null,
    canCompose: true,
    canCancel: false,
    canResume: false,
  },
};

export function getJobVisualState(job: Job | null): JobVisualState {
  if (!job) {
    return {
      kind: "greeting",
      title: "告诉 Mibo 你想做什么",
      percentage: null,
      detailItems: [],
      canCompose: true,
      canCancel: false,
      canResume: false,
    };
  }

  if (job.status === "RUNNING") {
    const knownPhase = job.phase as keyof typeof runningTitles;
    const title = runningTitles[knownPhase];
    return {
      kind: title ? knownPhase : "working",
      title: title ?? "正在处理需求",
      percentage: null,
      detailItems: [],
      canCompose: false,
      canCancel: true,
      canResume: false,
    };
  }

  const state = statusStates[job.status];
  return {
    ...state,
    detailItems:
      job.status === "FAILED" && job.error?.message ? [job.error.message] : [],
  };
}
