import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GatewayResponseError } from "@/core/api/errors";
import {
  describeScheduledTaskError,
  scheduledTaskErrorCode,
  SCHEDULED_TASK_ERROR_KEYS,
} from "@/core/scheduled-tasks/errors";
import { nextRunLine } from "@/core/scheduled-tasks/detail-presentation";
import { task } from "./fixtures";
import { enUS } from "@/core/i18n/locales/en-US";
import { zhCN } from "@/core/i18n/locales/zh-CN";

const errorContract = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../../contracts/scheduled_task_errors_contract.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as { ui_codes: string[] };

describe("scheduler real Gateway error envelope", () => {
  it("covers every UI contract code with existing readable English and Chinese copy", () => {
    expect(Object.keys(SCHEDULED_TASK_ERROR_KEYS).sort()).toEqual(
      [...errorContract.ui_codes].sort(),
    );
    for (const code of errorContract.ui_codes) {
      for (const translations of [enUS, zhCN]) {
        const described = describeScheduledTaskError(
          new GatewayResponseError(
            "host note",
            409,
            {
              detail: {
                code,
                message: "host note",
                params: { limit: "max_runs", used: 5, max_runs: 5 },
              },
            },
            "",
          ),
          translations,
        );
        expect(described.message, code).toBeTruthy();
        expect(described.message, code).not.toBe(
          translations.scheduledTasks.apiErrors.generic,
        );
        expect(described.message, code).not.toContain(code);
        if (translations === zhCN)
          expect(described.message, code).toMatch(/[一-鿿]/);
      }
    }
  });

  it.each(["future_api_code", "constructor", "__proto__", "toString"])(
    "unknown code %s preserves raw details and generic copy in both locales",
    (code) => {
      for (const translations of [enUS, zhCN]) {
        expect(
          describeScheduledTaskError(
            new GatewayResponseError(
              "host note",
              409,
              {
                detail: { code, message: "future reason" },
              },
              "",
            ),
            translations,
          ),
        ).toEqual({
          message: translations.scheduledTasks.apiErrors.generic,
          details: "future reason",
        });
      }
    },
  );
  it("localizes coded errors from the shared lossless response error", () => {
    const error = new GatewayResponseError(
      "server detail",
      409,
      {
        detail: {
          code: "limits_exhausted",
          message: "server detail",
          params: { limit: "max_runs", used: 5, max_runs: 5 },
        },
      },
      "",
    );
    expect(scheduledTaskErrorCode(error)).toBe("limits_exhausted");
    expect(describeScheduledTaskError(error, enUS).message).toContain("5");
    expect(describeScheduledTaskError(error, enUS).message).not.toBe(
      enUS.scheduledTasks.apiErrors.generic,
    );
  });
  it("distinguishes permission, validation and unknown errors", () => {
    expect(
      describeScheduledTaskError(
        new GatewayResponseError("denied", 403, { detail: "denied" }, ""),
        enUS,
      ),
    ).toEqual({
      message: enUS.scheduledTasks.apiErrors.permissionDenied,
      details: null,
    });
    expect(
      describeScheduledTaskError(
        new GatewayResponseError(
          "bad",
          422,
          { detail: [{ msg: "field required" }] },
          "",
        ),
        enUS,
      ),
    ).toEqual({
      message: enUS.scheduledTasks.apiErrors.invalidRequest,
      details: "field required",
    });
    expect(
      describeScheduledTaskError(
        new GatewayResponseError(
          "new",
          409,
          { detail: { code: "new_code", message: "future reason" } },
          "",
        ),
        enUS,
      ),
    ).toEqual({
      message: enUS.scheduledTasks.apiErrors.generic,
      details: "future reason",
    });
  });
  it("renders terminal and queued task state without broken imports", () => {
    expect(nextRunLine(task({ status: "completed" }), enUS, "en-US")).toBe(
      enUS.scheduledTasks.detail.noMoreRuns,
    );
    expect(
      nextRunLine(
        task({ status: "enabled", active_run_status: "queued" }),
        enUS,
        "en-US",
      ),
    ).toBe(enUS.scheduledTasks.actions.alreadyQueued);
  });
});
