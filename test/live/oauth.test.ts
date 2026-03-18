import { describe, expect, test } from "vite-plus/test";

import { createLiveTokenClients } from "./support/helpers.js";

const DISPOSABLE_CALLBACK = "https://example.com/codex-sdk-live/oauth/callback";
const DISPOSABLE_WEBSITE = "https://example.com/codex-sdk-live/oauth";
const DISPOSABLE_ICON_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlAb9sAAAAASUVORK5CYII=",
    "base64",
  ),
);

describe.sequential("oauth live", () => {
  const { authClient } = createLiveTokenClients();

  test("oauth apps query succeeds", async () => {
    const apps = await authClient.oauth.query();

    expect(Array.isArray(apps)).toBe(true);
  });

  test("popular apps payload is normalized", async () => {
    const apps = await authClient.oauth.getPopularApps();

    expect(Array.isArray(apps)).toBe(true);
    expect(
      apps.every(
        (app) =>
          typeof app.id === "number" &&
          typeof app.name === "string" &&
          typeof app.description === "string" &&
          typeof app.website === "string" &&
          typeof app.has_icon === "boolean",
      ),
    ).toBe(true);
  });

  test("oauth app detail succeeds for the configured app", async () => {
    const apps = await authClient.oauth.query();
    const configuredClientId = process.env.PUTIO_CLIENT_ID
      ? Number(process.env.PUTIO_CLIENT_ID)
      : NaN;
    const ownedAppId = apps.find((app) => app.id === configuredClientId)?.id ?? apps[0]?.id;

    if (ownedAppId === undefined) {
      expect(apps.length).toBe(0);
      return;
    }

    const app = await authClient.oauth.get(ownedAppId, { edit: true });

    expect(app.app.id).toBe(ownedAppId);
    expect(typeof app.token === "string" || app.token === null).toBe(true);
  });

  test("oauth disposable app lifecycle succeeds", async () => {
    const seed = Date.now();
    let createdId: number | null = null;

    try {
      const created = await authClient.oauth.create({
        callback: DISPOSABLE_CALLBACK,
        description: `codex oauth disposable ${seed}`,
        hidden: true,
        name: `Codex SDK Disposable ${seed}`,
        website: DISPOSABLE_WEBSITE,
      });

      createdId = created.app.id;
      if (!("hidden" in created.app) || !("secret" in created.app)) {
        throw new Error("expected editable oauth app payload after create");
      }
      expect(created.app.hidden).toBe(true);
      expect(created.app.secret.length).toBeGreaterThan(0);

      const updated = await authClient.oauth.update({
        callback: `${DISPOSABLE_CALLBACK}?updated=${seed}`,
        description: `codex oauth disposable updated ${seed}`,
        hidden: false,
        id: created.app.id,
        website: `${DISPOSABLE_WEBSITE}?updated=${seed}`,
      });

      expect(updated.app.id).toBe(created.app.id);
      if (!("hidden" in updated.app) || !("callback" in updated.app)) {
        throw new Error("expected editable oauth app payload after update");
      }
      expect(updated.app.hidden).toBe(false);
      expect(updated.app.callback).toContain("updated=");

      await authClient.oauth.setIcon(created.app.id, {
        icon: new Blob([DISPOSABLE_ICON_BYTES], {
          type: "image/png",
        }),
      });

      const regeneratedToken = await authClient.oauth.regenerateToken(created.app.id);
      expect(regeneratedToken.length).toBeGreaterThan(0);

      const validation = await authClient.auth.validateToken(regeneratedToken);
      expect(validation.result).toBe(true);

      await authClient.oauth.delete(created.app.id);
      createdId = null;
    } finally {
      if (createdId !== null) {
        await authClient.oauth.delete(createdId).catch(() => undefined);
      }
    }
  });
});
