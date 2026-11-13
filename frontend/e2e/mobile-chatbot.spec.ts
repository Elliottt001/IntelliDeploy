import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { components } from "@intellideploy/api-client";
import { getSourceMotion } from "../design/sourceMotionEvidence";
import { sampleSourceEasing } from "../features/navigation/sourceMotionPolicy";

type App = components["schemas"]["AppDetail"];
type Status = components["schemas"]["JobStatus"];
const timestamp = "2026-11-10T00:00:00Z";
function detail(status: Status | null): App {
  const job: components["schemas"]["JobSnapshot"] | null = status && {
    id: "job",
    app_id: "app",
    kind: "ADJUST",
    status,
    phase: "clarifying",
    usage_units: 10,
    event_cursor: 0,
    question: status === "WAITING_USER" ? "记录是否公开？" : null,
    result: null,
    error:
      status === "FAILED"
        ? { code: "CHECK_FAILED", message: "验证未通过", retryable: false }
        : null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const active =
    status &&
    ["QUEUED", "RUNNING", "WAITING_USER", "PAUSED_QUOTA"].includes(status)
      ? job
      : null;
  return {
    id: "app",
    name: "梦境记录",
    updated_at: timestamp,
    active_job_id: active?.id ?? null,
    active_job: active,
    latest_job: job,
    instance_status: "RUNNING",
    candidate_version_id: null,
    requirement: {
      prompt: "梦境记录",
      acceptance: [],
      revision: 1,
      facts: [],
      source_message_ids: [],
    },
    conversation: [
      {
        id: "m1",
        sequence: 1,
        role: "user",
        content: "记录并分析梦境",
        created_at: timestamp,
      },
    ],
    delivery: {
      app_id: "app",
      version_id: "old",
      instance_id: "instance",
      url: "https://fixture-app.example",
      summary: "原有梦境记录",
      features: ["保存记录"],
      report_url: "/api/jobs/old-job/report",
      artifact_url: "/api/apps/app/versions/old/artifact",
      published_at: timestamp,
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("token", "fixture-token"),
  );
  await page.route("**/auth/me", (route) =>
    route.fulfill({ json: { id: 1, username: "owner", email: "owner@test" } }),
  );
  await page.route("**/api/quota/**", (route) =>
    route.fulfill({
      json: {
        available_units: 900,
        reserved_units: 100,
        default_budget_units: 100,
        hard_cap_units: 1000,
        price_version: "fixture",
        failed_usage_rule: "失败按实际用量结算",
        items: [],
      },
    }),
  );
});
test("normal management menu reveals and closes real running controls while preserving the focused draft and actual phase", async ({
  page,
}) => {
  const app = detail("RUNNING");
  await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (r) =>
    r.fulfill({ json: app.latest_job }),
  );
  await page.goto("/app-detail/app");
  await page.getByTestId("message-input").fill("保留当前草稿");
  await expect(page.getByTestId("job-status")).toHaveText("正在理解需求");
  await expect(page.getByTestId("cancel-job")).toHaveCount(0);
  const menu = page.getByTestId("chatbot-settings");
  await menu.click();
  const entry = page.getByTestId("delivery-management-toggle");
  expect((await entry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await entry.click();
  await expect(page.getByTestId("cancel-job")).toBeVisible();
  await expect(page.getByTestId("refresh-job")).toBeVisible();
  await expect(page.getByTestId("message-input")).toHaveValue("保留当前草稿");
  await menu.click();
  await page.getByTestId("delivery-management-toggle").click();
  await expect(page.getByTestId("cancel-job")).toHaveCount(0);
  await expect(page.getByTestId("refresh-job")).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toHaveValue("保留当前草稿");
  await expect(page.getByTestId("send-message")).toBeDisabled();
  await menu.click();
  await page.getByTestId("job-phases-toggle").click();
  await expect(page.getByTestId("job-progress-clarifying")).toBeVisible();
});

for (const status of [
  null,
  "QUEUED",
  "RUNNING",
  "WAITING_USER",
  "PAUSED_QUOTA",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const) {
  test(`Mibo ${status ?? "no job"} exposes only state-allowed actions and retains old delivery`, async ({
    page,
  }) => {
    const app = detail(status);
    await page.route("**/api/apps/app", (route) =>
      route.fulfill({ json: app }),
    );
    await page.route("**/api/jobs/job", (route) =>
      route.fulfill({ json: app.latest_job }),
    );
    await page.goto("/app-detail/app");
    await expect(page.getByTestId("mibo-stage")).toBeVisible();
    await expect(page.getByTestId("open-app")).toBeVisible();
    await page.getByTestId("chatbot-settings").click();
    await page.getByTestId("delivery-management-toggle").click();
    await expect(page.getByTestId("app-detail-secondary")).toBeVisible();
    await page.getByTestId("chatbot-settings").click();
    await page.getByTestId("conversation-toggle").click();
    await expect(
      page.getByText("记录并分析梦境", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("cancel-job")).toHaveCount(
      status === "RUNNING" || status === "QUEUED" ? 1 : 0,
    );
    await expect(page.getByTestId("resume-job")).toHaveCount(
      status === "PAUSED_QUOTA" ? 1 : 0,
    );
    for (const control of [
      "cancel-job",
      "resume-job",
      "refresh-job",
      "restart-app",
    ]) {
      const target = page.getByTestId(control);
      if (await target.count()) {
        const box = await target.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
    }
    await page.getByTestId("message-input").fill("保持私有");
    if (["RUNNING", "QUEUED", "PAUSED_QUOTA"].includes(status ?? ""))
      await expect(page.getByTestId("send-message")).toBeDisabled();
    else await expect(page.getByTestId("send-message")).toBeEnabled();
    if (status === "WAITING_USER")
      await expect(page.getByTestId("mibo-question")).toHaveText(
        "记录是否公开？",
      );
    if (status === "FAILED")
      await expect(page.getByTestId("mibo-error")).toHaveText("验证未通过");
    if (status === "CANCELLED")
      await expect(page.getByTestId("restart-app")).toBeVisible();
    await expect(page.getByText(/%/)).toHaveCount(0);
  });
}

test("network retry preserves the last running snapshot and recovers", async ({
  page,
}) => {
  const app = detail("RUNNING");
  let offline = true;
  await page.route("**/api/apps/app", (route) => route.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (route) =>
    offline ? route.abort() : route.fulfill({ json: app.latest_job }),
  );
  await page.goto("/app-detail/app");
  await expect(page.getByTestId("network-retry")).toContainText(
    "网络连接暂时中断",
  );
  await expect(page.getByTestId("job-status")).toHaveText("正在理解需求");
  await page.getByTestId("chatbot-settings").click();
  await page.getByTestId("delivery-management-toggle").click();
  await expect(page.getByTestId("cancel-job")).toBeVisible();
  await expect(page.getByTestId("open-app")).toBeVisible();
  offline = false;
  await page.getByTestId("refresh-job").click();
  await expect(page.getByTestId("network-retry")).toHaveCount(0);
  await expect(page.getByTestId("job-status")).toHaveText("正在理解需求");
});

test("402 reads the paused task, preserves its draft, and resume retries use one request key", async ({
  page,
}) => {
  let app = detail("WAITING_USER");
  const keys: string[] = [];
  let sends = 0;
  await page.route("**/api/apps/app", (route) => route.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (route) =>
    route.fulfill({ json: app.latest_job }),
  );
  await page.route("**/api/apps/app/messages", async (route) => {
    sends++;
    app = detail("PAUSED_QUOTA");
    await route.fulfill({
      status: 402,
      json: {
        error: {
          code: "QUOTA_EXCEEDED",
          message: "额度不足",
          retryable: false,
        },
      },
    });
  });
  await page.route("**/api/jobs/job/resume", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) await route.abort();
    else {
      app = detail("RUNNING");
      await route.fulfill({
        status: 202,
        json: { app_id: "app", job_id: "job", status: "RUNNING" },
      });
    }
  });
  await page.goto("/app-detail/app");
  await page.getByTestId("message-input").fill("保持私有");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("job-status")).toHaveText(
    "额度不足，任务已暂停",
  );
  await expect(page.getByTestId("message-input")).toHaveValue("保持私有");
  await expect(page.getByTestId("send-message")).toBeDisabled();
  await page.getByTestId("resume-job").click();
  await expect(page.getByTestId("workspace-error")).toBeVisible();
  await page.getByTestId("resume-job").click();
  await page.getByTestId("chatbot-settings").click();
  await page.getByTestId("delivery-management-toggle").click();
  await expect(page.getByTestId("cancel-job")).toBeVisible();
  expect(sends).toBe(1);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
});

test("creation retains its draft and key after network failure and reload", async ({
  page,
}) => {
  const keys: string[] = [];
  const diagnostics: string[] = [];
  page.on("console", (message) => {
    if (
      /Invalid style property|accessibilityElementsHidden/.test(message.text())
    )
      diagnostics.push(message.text());
  });
  const app = { ...detail("QUEUED"), delivery: null, instance_status: null };
  await page.route("**/api/apps/app", (route) => route.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (route) =>
    route.fulfill({ json: app.latest_job }),
  );
  await page.route("**/api/apps", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) await route.abort();
    else
      await route.fulfill({
        status: 201,
        json: { app_id: "app", job_id: "job", status: "QUEUED" },
      });
  });
  await page.goto("/chatbot");
  await expect(page.getByTestId("mibo-stage")).toBeVisible();
  await page.getByTestId("create-prompt").fill("记录并分析梦境");
  await page.getByTestId("create-app").click();
  await expect(page.getByTestId("workspace-error")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("create-prompt")).toHaveValue("记录并分析梦境");
  await page.getByTestId("create-app").click();
  await expect(page).toHaveURL(/\/app-detail\/app/);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
  expect(diagnostics).toEqual([]);
});

test("creation and conversation controls remain 44px and in bounds at mobile widths", async ({
  page,
}) => {
  const app = detail("WAITING_USER");
  await page.route("**/api/apps/app", (route) => route.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (route) =>
    route.fulfill({ json: app.latest_job }),
  );
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 812 });
    for (const [path, input, button] of [
      ["/chatbot", "create-prompt", "create-app"],
      ["/app-detail/app", "message-input", "send-message"],
    ]) {
      await page.goto(path);
      await page.getByTestId(input).fill("移动端需求");
      await page.getByTestId(button).scrollIntoViewIfNeeded();
      await page.getByTestId("chatbot-settings").click();
      for (const id of [
        input,
        button,
        "chatbot-back",
        "chatbot-products",
        "chatbot-settings",
      ]) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
    }
  }
});

test("Mibo local art and composer remain in bounds at all required mobile widths and short screens", async ({
  page,
}) => {
  const app = detail("WAITING_USER");
  await page.route("**/api/apps/app", (route) => route.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (route) =>
    route.fulfill({ json: app.latest_job }),
  );
  for (const width of [320, 360, 375, 390, 430])
    for (const height of [640, 812, 932]) {
      await page.setViewportSize({ width, height });
      await page.goto("/app-detail/app");
      const art = (await page.getByTestId("mibo-art-canvas").boundingBox())!;
      const artViewport = (await page
        .getByTestId("mibo-art-viewport")
        .boundingBox())!;
      const composer = (await page.getByTestId("chat-composer").boundingBox())!;
      expect(art.x).toBeGreaterThanOrEqual(0);
      expect(art.x + art.width).toBeLessThanOrEqual(width);
      if (width === 320 || width === 360) {
        expect(art.y).toBeCloseTo(artViewport.y, 1);
        expect(art.y + art.height).toBeCloseTo(
          artViewport.y + artViewport.height,
          1,
        );
        expect(art.width / art.height).toBeCloseTo(375 / 330, 3);
      }
      expect(composer.x).toBeGreaterThanOrEqual(0);
      expect(composer.x + composer.width).toBeLessThanOrEqual(width);
      expect(composer.y + composer.height).toBeLessThanOrEqual(height);
      const input = (await page.getByTestId("message-input").boundingBox())!,
        send = (await page.getByTestId("send-message").boundingBox())!;
      expect(input.x + input.width).toBeLessThanOrEqual(send.x);
    }
});

test("matching question and latest assistant render once while the byte-exact history remains complete", async ({
  page,
}) => {
  const duplicate = "\uFEFF记录是否公开？\r\n\r\n请确认";
  const app = detail("WAITING_USER");
  app.latest_job!.question = duplicate;
  app.active_job!.question = duplicate;
  app.conversation.push({
    id: "assistant",
    sequence: 2,
    role: "assistant",
    content: duplicate,
    created_at: timestamp,
  });
  await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (r) =>
    r.fulfill({ json: app.latest_job }),
  );
  await page.goto("/app-detail/app");
  await expect(page.getByTestId("mibo-question")).toHaveText(duplicate);
  await expect(page.getByTestId("latest-assistant-reply")).toHaveCount(0);
  await page.getByTestId("chatbot-settings").click();
  await page.getByTestId("conversation-toggle").click();
  // The focused presentation is deduplicated; opening full history deliberately reveals the retained assistant row.
  await expect(page.getByText(duplicate, { exact: true })).toHaveCount(2);
  expect(app.conversation.at(-1)?.content).toBe(duplicate);
});

test("a 500 app detail remains an honest retryable error with working return navigation", async ({
  page,
}) => {
  let attempts = 0,
    sends = 0;
  const keys: string[] = [];
  const recovered = detail("WAITING_USER");
  await page.route("**/api/apps/app", (route) => {
    attempts++;
    return attempts === 1
      ? route.fulfill({
          status: 500,
          json: {
            error: {
              code: "INTERNAL_ERROR",
              message: "详情暂不可用",
              retryable: true,
            },
          },
        })
      : route.fulfill({ json: recovered });
  });
  await page.route("**/api/jobs/job", (route) =>
    route.fulfill({ json: recovered.latest_job }),
  );
  await page.route("**/api/apps/app/messages", (route) => {
    sends++;
    keys.push(route.request().headers()["idempotency-key"]);
    return route.fulfill({
      status: 202,
      json: { app_id: "app", job_id: "job", status: "QUEUED" },
    });
  });
  await page.goto("/app-detail/app");
  await expect(page.getByTestId("workspace-error")).toBeVisible();
  await expect(page.getByTestId("retry-app-detail")).toBeVisible();
  await expect(page.getByTestId("chatbot-back")).toBeVisible();
  await page.getByTestId("retry-app-detail").click();
  await expect(page.getByTestId("job-status")).toHaveText("需要你补充一点信息");
  const input = page.getByTestId("message-input");
  await expect(input).toBeEditable();
  await input.fill("重试后只发送一次");
  await page.getByTestId("send-message").click();
  expect(sends).toBe(1);
  expect(keys[0]).toBeTruthy();
  expect(attempts).toBeGreaterThanOrEqual(2);
});

for (const viewportHeight of [640, 812, 932]) {
  test(`Mibo slide uses the responsive ${viewportHeight}pt boundary and source midpoint`, async ({
    page,
  }) => {
    let app = detail("RUNNING"),
      advance = false;
    app.latest_job!.phase = "validating";
    app.active_job!.phase = "validating";
    app.conversation.push({
      id: "assistant",
      sequence: 2,
      role: "assistant",
      content: "真实验证回复",
      created_at: timestamp,
    });
    await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
    await page.route("**/api/jobs/job", (r) => {
      if (advance) {
        app = detail("RUNNING");
        app.latest_job!.phase = "deploying";
        app.active_job!.phase = "deploying";
        app.conversation.push({
          id: "assistant",
          sequence: 2,
          role: "assistant",
          content: "真实部署回复",
          created_at: timestamp,
        });
      }
      return r.fulfill({ json: app.latest_job });
    });
    await page.setViewportSize({ width: 375, height: viewportHeight });
    await page.clock.install();
    await page.goto("/app-detail/app");
    await page.getByTestId("chatbot-settings").click();
    await page.getByTestId("delivery-management-toggle").click();
    advance = true;
    await page.getByTestId("refresh-job").click();
    const current = page.getByTestId("mibo-composition-current"),
      previous = page.getByTestId("mibo-composition-previous"),
      offset = async () =>
        current.evaluate((element) => {
          const value = getComputedStyle(element).transform;
          return value === "none" ? 0 : new DOMMatrix(value).m42;
        });
    await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
      "data-source-motion",
      "852:4343",
    );
    expect(Math.abs((await offset()) - viewportHeight)).toBeLessThan(2);
    await expect(previous).toHaveCSS("pointer-events", "none");
    await expect(previous).toHaveAttribute("aria-hidden", "true");
    await expect(previous).toHaveCSS("opacity", "1");
    await expect(
      page.getByRole("heading", { name: "正在发布应用" }),
    ).toHaveCount(1);
    await expect(page.getByTestId("latest-assistant-reply")).toHaveCount(1);
    await expect(page.getByLabel("Mibo 最新回复")).toHaveCount(1);
    const motion = getSourceMotion("852:4061", "AFTER_TIMEOUT", "852:4150")!;
    await page.clock.runFor(motion.durationMs / 2);
    expect(
      Math.abs(
        (await offset()) -
          viewportHeight * (1 - sampleSourceEasing(motion, 0.5)),
      ) / viewportHeight,
    ).toBeLessThan(0.08);
    await page.clock.runFor(motion.durationMs / 2);
    expect(await offset()).toBeCloseTo(0, 1);
  });
}

test("Mibo SMART animates only matching raw character and status properties", async ({
  page,
}) => {
  let app = detail("RUNNING"),
    advance = false;
  app.latest_job!.phase = "clarifying";
  app.active_job!.phase = "clarifying";
  app.conversation.push({
    id: "assistant",
    sequence: 2,
    role: "assistant",
    content: "真实理解回复",
    created_at: timestamp,
  });
  await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (r) => {
    if (advance) {
      app = detail("RUNNING");
      app.latest_job!.phase = "retrieving";
      app.active_job!.phase = "retrieving";
      app.conversation.push({
        id: "assistant",
        sequence: 2,
        role: "assistant",
        content: "真实检索回复",
        created_at: timestamp,
      });
    }
    return r.fulfill({ json: app.latest_job });
  });
  await page.clock.install();
  await page.goto("/app-detail/app");
  await page.getByTestId("chatbot-settings").click();
  await page.getByTestId("delivery-management-toggle").click();
  advance = true;
  await page.getByTestId("refresh-job").click();
  const cat = page.getByTestId("mibo-cat"),
    canvas = page.getByTestId("mibo-art-canvas"),
    origin = async () => {
      const [catBox, canvasBox] = await Promise.all([
        cat.boundingBox(),
        canvas.boundingBox(),
      ]);
      return { x: catBox!.x - canvasBox!.x, y: catBox!.y - canvasBox!.y + 137 };
    };
  await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
    "data-source-motion",
    "852:4339",
  );
  await expect(page.getByTestId("mibo-composition-previous")).toHaveCount(0);
  await expect(page.getByTestId("mibo-composition-current")).toHaveCSS(
    "opacity",
    "1",
  );
  const start = await origin();
  expect(start.x).toBeCloseTo(94, 1);
  expect(start.y).toBeCloseTo(154, 0);
  const status = page.getByTestId("job-status");
  await expect(status).toHaveCSS("opacity", "1");
  expect(
    await status.evaluate((element) => {
      const value = getComputedStyle(element).transform;
      if (value === "none") return { x: 0, y: 0 };
      const matrix = new DOMMatrix(value);
      return { x: matrix.m41, y: matrix.m42 };
    }),
  ).toEqual({ x: 0, y: 0 });
  await expect(
    page.getByRole("heading", { name: "正在查找可复用项目" }),
  ).toHaveCount(1);
  await expect(page.getByTestId("latest-assistant-reply")).toHaveText(
    "真实检索回复",
  );
  const motion = getSourceMotion("849:3705", "AFTER_TIMEOUT", "849:3794")!;
  await page.clock.runFor(motion.durationMs / 2);
  const eased = sampleSourceEasing(motion, 0.5);
  expect(
    Math.abs((await origin()).y - (154 + (184 - 154) * eased)),
  ).toBeLessThan(1);
  await expect(page.getByTestId("mibo-composition-current")).toHaveCSS(
    "opacity",
    "1",
  );
  await page.clock.runFor(motion.durationMs / 2);
  expect((await origin()).y).toBeCloseTo(184, 1);
});

test("Mibo replaces an in-flight transition, pauses in background, and resumes without stale rollback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let state: "visible" | "hidden" = "visible";
    Object.defineProperties(document, {
      visibilityState: { configurable: true, get: () => state },
      hidden: { configurable: true, get: () => state === "hidden" },
    });
    (
      window as typeof window & {
        __setMiboVisibility?: (value: "visible" | "hidden") => void;
      }
    ).__setMiboVisibility = (value) => {
      state = value;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });
  let app = detail("RUNNING"),
    reads = 0,
    forceSuccess = false;
  app.latest_job!.phase = "validating";
  app.active_job!.phase = "validating";
  await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (r) => {
    reads++;
    if (forceSuccess) {
      app = detail("SUCCEEDED");
      app.latest_job!.phase = "verifying_live";
      app.conversation.push({
        id: "assistant-success",
        sequence: 2,
        role: "assistant",
        content: "真实交付回复",
        created_at: timestamp,
      });
    } else if (reads > 1) {
      app = detail("RUNNING");
      app.latest_job!.phase = "deploying";
      app.active_job!.phase = "deploying";
    }
    return r.fulfill({ json: app.latest_job });
  });
  await page.clock.install();
  await page.goto("/app-detail/app");
  await page.clock.runFor(2999);
  await page.clock.runFor(1);
  const current = page.getByTestId("mibo-composition-current");
  const offset = async () =>
    current.evaluate((element) => {
      const value = getComputedStyle(element).transform;
      return value === "none" ? 0 : new DOMMatrix(value).m42;
    });
  await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
    "data-source-frame",
    "852:4150",
  );
  await expect.poll(offset).toBeGreaterThan(0);
  await page.evaluate(() =>
    (
      window as typeof window & {
        __setMiboVisibility?: (value: "visible" | "hidden") => void;
      }
    ).__setMiboVisibility?.("hidden"),
  );
  const paused = await offset();
  await page.clock.runFor(300);
  expect(await offset()).toBeCloseTo(paused, 1);
  await page.evaluate(() =>
    (
      window as typeof window & {
        __setMiboVisibility?: (value: "visible" | "hidden") => void;
      }
    ).__setMiboVisibility?.("visible"),
  );
  await page.clock.runFor(100);
  expect(await offset()).toBeLessThan(paused);
  forceSuccess = true;
  await page.getByTestId("chatbot-settings").click();
  await page.getByTestId("delivery-management-toggle").click();
  await page.getByTestId("refresh-job").click();
  await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
    "data-source-motion",
    "852:4364",
  );
  await page.clock.runFor(800);
  await expect(current.getByTestId("job-status")).toHaveText("应用已交付");
  await expect(page.getByTestId("mibo-composition-previous")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.getByTestId("latest-assistant-reply")).toHaveCount(1);
  await page.clock.runFor(1000);
  await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
    "data-source-frame",
    "852:4391",
  );
});

test("Mibo reduced motion completes the whole target composition without timing residue", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query === "(prefers-reduced-motion: reduce)"
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return true;
            },
          } as MediaQueryList)
        : original(query);
  });
  let app = detail("RUNNING"),
    reads = 0;
  app.latest_job!.phase = "validating";
  app.active_job!.phase = "validating";
  await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (r) => {
    reads++;
    if (reads > 1) {
      app = detail("RUNNING");
      app.latest_job!.phase = "deploying";
      app.active_job!.phase = "deploying";
    }
    return r.fulfill({ json: app.latest_job });
  });
  await page.clock.install();
  await page.goto("/app-detail/app");
  await page.clock.runFor(3000);
  const current = page.getByTestId("mibo-composition-current");
  expect(
    await current.evaluate((element) => {
      const value = getComputedStyle(element).transform;
      return value === "none" ? 0 : new DOMMatrix(value).m42;
    }),
  ).toBe(0);
  await expect(page.getByTestId("mibo-composition-previous")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(current.getByTestId("job-status")).toHaveText("正在发布应用");
});

test("composer follows visual keyboard show and hide without covering the scroll viewport", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let keyboardHeight = 0;
    const target = new EventTarget();
    Object.defineProperties(target, {
      height: { get: () => window.innerHeight - keyboardHeight },
      width: { get: () => window.innerWidth },
      offsetTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      pageTop: { get: () => 0 },
      pageLeft: { get: () => 0 },
      scale: { get: () => 1 },
      addEventListener: { value: target.addEventListener.bind(target) },
      removeEventListener: { value: target.removeEventListener.bind(target) },
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: target,
    });
    (
      window as typeof window & {
        __setKeyboardHeight?: (value: number) => void;
      }
    ).__setKeyboardHeight = (value) => {
      keyboardHeight = value;
      target.dispatchEvent(new Event("resize"));
    };
  });
  const app = detail("WAITING_USER");
  await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (r) =>
    r.fulfill({ json: app.latest_job }),
  );
  await page.goto("/app-detail/app");
  const anchor = page.getByTestId("chatbot-composer-anchor");
  expect((await anchor.boundingBox())!.y).toBeCloseTo(729, 1);
  await page.evaluate(() =>
    (
      window as typeof window & {
        __setKeyboardHeight?: (value: number) => void;
      }
    ).__setKeyboardHeight?.(300),
  );
  await expect
    .poll(async () => (await anchor.boundingBox())!.y)
    .toBeCloseTo(429, 1);
  const scroll = await page.getByTestId("mibo-stage").evaluate((element) => {
    let current = element.parentElement;
    while (current && getComputedStyle(current).overflowY !== "auto")
      current = current.parentElement;
    return current?.getBoundingClientRect().bottom;
  });
  expect(scroll).toBeLessThanOrEqual((await anchor.boundingBox())!.y + 1);
  await page.evaluate(() =>
    (
      window as typeof window & {
        __setKeyboardHeight?: (value: number) => void;
      }
    ).__setKeyboardHeight?.(0),
  );
  await expect
    .poll(async () => (await anchor.boundingBox())!.y)
    .toBeCloseTo(729, 1);
});

test("only a real Job snapshot change starts its matching source transition", async ({
  page,
}) => {
  let app = detail("RUNNING"),
    reads = 0;
  app.latest_job!.phase = "clarifying";
  app.active_job!.phase = "clarifying";
  await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (r) => {
    reads++;
    if (reads > 1) {
      app = detail("RUNNING");
      app.latest_job!.phase = "retrieving";
      app.active_job!.phase = "retrieving";
    }
    return r.fulfill({ json: app.latest_job });
  });
  await page.clock.install();
  await page.goto("/app-detail/app");
  await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
    "data-source-frame",
    "849:3705",
  );
  await page.clock.runFor(2999);
  await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
    "data-source-frame",
    "849:3705",
  );
  await page.clock.runFor(1);
  await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
    "data-source-frame",
    "849:3794",
  );
  await expect(page.getByTestId("mibo-stage")).toHaveAttribute(
    "data-source-motion",
    "852:4339",
  );
});

test("a 20k draft and long actual reply scroll above the anchored composer on a short screen", async ({
  page,
}) => {
  const app = detail("RUNNING");
  app.latest_job!.phase = "building";
  app.active_job!.phase = "building";
  app.conversation.push({
    id: "assistant",
    sequence: 2,
    role: "assistant",
    content: Array.from(
      { length: 120 },
      (_, index) => `真实回复第${index + 1}行`,
    ).join("\r\n"),
    created_at: timestamp,
  });
  await page.route("**/api/apps/app", (r) => r.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (r) =>
    r.fulfill({ json: app.latest_job }),
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/app-detail/app");
  const input = page.getByTestId("message-input"),
    draft = "字".repeat(20001);
  await input.fill(draft);
  await expect(input).toHaveValue("字".repeat(20000));
  const reply = page.getByTestId("latest-assistant-reply");
  await reply.scrollIntoViewIfNeeded();
  const composerBox = (await page.getByTestId("chat-composer").boundingBox())!;
  const scroll = await reply.evaluate((element) => {
    let current = element.parentElement;
    while (
      current &&
      getComputedStyle(current).overflowY !== "auto" &&
      getComputedStyle(current).overflowY !== "scroll"
    )
      current = current.parentElement;
    if (!current) throw Error("reply scroll container missing");
    const box = current.getBoundingClientRect();
    return {
      bottom: box.bottom,
      clientHeight: current.clientHeight,
      scrollHeight: current.scrollHeight,
    };
  });
  expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
  expect(scroll.bottom).toBeLessThanOrEqual(composerBox.y + 1);
});

test("chatbot layout binds source geometry from the provided Figma package", async ({
  page,
}) => {
  const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
  test.skip(!source, "Actual external Figma package audit is opt-in");
  const sourceDocument = JSON.parse(
    fs.readFileSync(
      path.join(source!, "design-data/document.kiwi.json"),
      "utf8",
    ),
  );
  const node = (id: string) =>
    sourceDocument.nodeChanges.find(
      (value: { guid: { sessionID: number; localID: number } }) =>
        `${value.guid.sessionID}:${value.guid.localID}` === id,
    );
  const shell = node("845:3530");
  const header = node("845:3502");
  const text = node("845:3532");
  await page.goto("/chatbot");
  await expect(page.getByTestId("create-prompt")).toBeVisible();
  const input = page.getByTestId("create-prompt");
  const measured = await input.locator("..").evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    // Chromium rounds computed border width to physical pixels; compare the authored RN declaration.
    const paint = element.firstElementChild as HTMLElement,
      paintStyle = getComputedStyle(paint);
    const declarations = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule && paint.matches(rule.selectorText),
      );
    const borderRule = declarations
      .filter(
        (rule) =>
          rule.selectorText.startsWith(".") &&
          (rule.style.borderTopWidth || rule.style.borderWidth),
      )
      .at(-1);
    const border =
      paint.style.borderTopWidth ||
      paint.style.borderWidth ||
      borderRule?.style.borderTopWidth ||
      borderRule?.style.borderWidth;
    const paintBox = paint.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      radius: parseFloat(style.borderRadius),
      structuralBorder: parseFloat(style.borderTopWidth),
      border: parseFloat(border!),
      renderedBorder: parseFloat(paintStyle.borderTopWidth),
      paintWidth: paintBox.width,
      paintHeight: paintBox.height,
      pixelRatio: window.devicePixelRatio,
    };
  });
  expect(measured.width).toBe(shell.size.x);
  expect(measured.height).toBe(shell.size.y);
  expect(measured.radius).toBeCloseTo(shell.cornerRadius, 3);
  expect(measured.structuralBorder).toBe(0);
  expect(measured.paintWidth).toBe(shell.size.x);
  expect(measured.paintHeight).toBe(shell.size.y);
  expect(measured.border).toBeCloseTo(shell.strokeWeight, 3);
  expect(measured.renderedBorder).toBe(
    Math.floor(shell.strokeWeight * measured.pixelRatio) / measured.pixelRatio,
  );
  expect(
    await input.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBe(text.fontSize);
  const headerBox = await page
    .getByTestId("chatbot-back")
    .locator("..")
    .boundingBox();
  // The source's 38pt header controls are centered in the required 44pt native hit frames.
  expect(headerBox!.height).toBe(44);
  expect(headerBox!.width).toBe(header.size.x + 44 - header.size.y);
  expect(headerBox!.x).toBe(header.transform.m02 - (44 - header.size.y) / 2);
  expect(headerBox!.y).toBe(header.transform.m12 - (44 - header.size.y) / 2);
});

test("cancel retries retain one request key and preserve the existing delivery", async ({
  page,
}) => {
  let app = detail("RUNNING");
  const keys: string[] = [];
  await page.route("**/api/apps/app", (route) => route.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (route) =>
    route.fulfill({ json: app.latest_job }),
  );
  await page.route("**/api/jobs/job/cancel", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) await route.abort();
    else {
      app = detail("CANCELLED");
      await route.fulfill({ json: app.latest_job });
    }
  });
  await page.goto("/app-detail/app");
  await page.getByTestId("chatbot-settings").click();
  await page.getByTestId("delivery-management-toggle").click();
  await page.getByTestId("cancel-job").click();
  await expect(page.getByTestId("workspace-error")).toBeVisible();
  await expect(page.getByTestId("job-status")).toHaveText("正在理解需求");
  await page.getByTestId("cancel-job").click();
  await expect(page.getByTestId("job-status")).toHaveText("任务已取消");
  await expect(page.getByTestId("open-app")).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
});

test("a cancel conflict rereads the terminal app without retrying the operation", async ({
  page,
}) => {
  let app = detail("RUNNING");
  let cancels = 0;
  await page.route("**/api/apps/app", (route) => route.fulfill({ json: app }));
  await page.route("**/api/jobs/job", (route) =>
    app.latest_job!.status === "CANCELLED"
      ? route.abort()
      : route.fulfill({ json: app.latest_job }),
  );
  await page.route("**/api/jobs/job/cancel", async (route) => {
    cancels++;
    app = detail("CANCELLED");
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "CONFLICT",
          message: "任务状态已变化",
          retryable: false,
        },
      },
    });
  });
  await page.goto("/app-detail/app");
  await page.getByTestId("chatbot-settings").click();
  await page.getByTestId("delivery-management-toggle").click();
  await page.getByTestId("cancel-job").click();
  await expect(page.getByTestId("job-status")).toHaveText("任务已取消");
  await expect(page.getByTestId("cancel-job")).toHaveCount(0);
  await expect(page.getByTestId("open-app")).toBeVisible();
  expect(cancels).toBe(1);
});
