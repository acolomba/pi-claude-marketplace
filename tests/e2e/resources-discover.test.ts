import assert from "node:assert/strict";
import { test } from "node:test";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";

import { installTargetWithMockPi, withE2EEnvironment } from "./_helpers.ts";

test("resources_discover covers /reload by returning staged skill and prompt resources", async () => {
  await withE2EEnvironment(async (env) => {
    const { mock, ctx } = await installTargetWithMockPi(env, "frontend-design", []);
    await installTargetWithMockPi(env, "code-review", []);

    await claudeMarketplaceExtension(mock.pi);
    const handler = mock.events.get("resources_discover")?.[0];
    assert.ok(handler !== undefined, "resources_discover handler registered");

    const result = await handler({ reason: "reload", cwd: ctx.cwd }, ctx);
    assert.ok(result.skillPaths.some((entry) => entry.includes("frontend-design")));
    assert.ok(result.promptPaths.some((entry) => entry.includes("code-review")));
  });
});
