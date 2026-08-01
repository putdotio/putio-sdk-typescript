import { spawnSync } from "node:child_process";

import { bootstrapFirstPartyTokenWithCredentials } from "../test/live/support/bootstrap.ts";
import { requireLiveFriendWithSharedFiles } from "../test/live/support/friends.ts";
import { requireOwnedVideoFixture } from "../test/live/support/media.ts";
import {
  readFirstPartyClientCredentials,
  readLiveTokens,
  readOptionalSecret,
  readSecondaryCredentialFixture,
} from "../test/live/support/secrets.ts";

import type { PutioSdkConfigShape, PutioSdkPromiseClient } from "../dist/index.js";

type FixtureCheckStatus = "blocked" | "not_checked" | "passed";

type FixtureCheck = {
  readonly details?: Record<string, unknown>;
  readonly name: string;
  readonly status: FixtureCheckStatus;
};

const packageDir = new URL("..", import.meta.url);
const seedInviteCodes = process.argv.includes("--seed-invite-codes");

const buildResult = spawnSync("vp", ["pack"], {
  cwd: packageDir,
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const { createPutioSdkPromiseClient } = await import("../dist/index.js");

const createClient = (config: PutioSdkConfigShape = {}): PutioSdkPromiseClient =>
  createPutioSdkPromiseClient(config);

const checks: FixtureCheck[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const errorMessage = (error: unknown): string => {
  if (isRecord(error)) {
    const reason = isRecord(error.reason) ? error.reason : {};
    const typedError = [
      typeof error._tag === "string" ? error._tag : undefined,
      typeof error.domain === "string" ? error.domain : undefined,
      typeof error.operation === "string" ? error.operation : undefined,
      typeof error.status === "number" ? String(error.status) : undefined,
      typeof reason.errorType === "string" ? reason.errorType : undefined,
    ].filter((part) => part !== undefined);

    if (typedError.length > 0) {
      return typedError.join(" ");
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return String(error);
};

const assertCondition = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const runCheck = async (
  name: string,
  fn: () => Promise<Record<string, unknown> | void>,
): Promise<void> => {
  try {
    const details = await fn();
    checks.push(
      details === undefined
        ? {
            name,
            status: "passed",
          }
        : {
            details,
            name,
            status: "passed",
          },
    );
  } catch (error) {
    checks.push({
      details: {
        error: errorMessage(error),
      },
      name,
      status: "blocked",
    });
  }
};

const recordNotChecked = (name: string, details: Record<string, unknown>): void => {
  checks.push({
    details,
    name,
    status: "not_checked",
  });
};

const tokens = readLiveTokens();
const primaryClient = createClient({
  accessToken: tokens.firstPartyToken,
});
const publicClient = createClient();

let secondaryClientPromise: Promise<PutioSdkPromiseClient> | null = null;

const getSecondaryClient = async (): Promise<PutioSdkPromiseClient> => {
  const secondaryFixture = readSecondaryCredentialFixture();

  if (!secondaryFixture) {
    throw new Error(
      "Missing PUTIO_TEST_SECONDARY_USERNAME / PUTIO_TEST_SECONDARY_PASSWORD for secondary account fixture.",
    );
  }

  secondaryClientPromise ??= bootstrapFirstPartyTokenWithCredentials(
    secondaryFixture,
    readFirstPartyClientCredentials(),
  ).then((token) =>
    createClient({
      accessToken: token.accessToken,
    }),
  );

  return secondaryClientPromise;
};

await runCheck("friend/share secondary fixture", async () => {
  const friend = await requireLiveFriendWithSharedFiles(primaryClient, async (config = {}) =>
    createClient(config),
  );

  return {
    friend: friend.name,
    has_shared_files: friend.has_shared_files,
  };
});

await runCheck("secondary friend-invite lookup fixture", async () => {
  const secondaryClient = await getSecondaryClient();
  const invites = await secondaryClient.friendInvites.list();
  let unused = invites.invites.find((invite) => invite.user === null);
  let source = "existing";

  if (!unused && seedInviteCodes) {
    const created = await secondaryClient.friendInvites.create();
    const afterCreate = await secondaryClient.friendInvites.list();
    unused = afterCreate.invites.find((invite) => invite.code === created.code) ?? {
      code: created.code,
      created_at: "",
      user: null,
    };
    source = "seeded";
  }

  if (!unused) {
    throw new Error(
      "Secondary account has no unused friend-invite code. Re-run with --seed-invite-codes to intentionally create one.",
    );
  }

  const publicInvite = await publicClient.auth.getFriendInvite(unused.code);

  return {
    code_length: unused.code.length,
    inviter: publicInvite.inviter,
    plan_code: publicInvite.plan.code,
    source,
  };
});

await runCheck("secondary family-invite lookup fixture", async () => {
  const secondaryClient = await getSecondaryClient();
  const invites = await secondaryClient.family.listInvites();
  let unused = invites.invites.find((invite) => invite.user_id === null);
  let source = "existing";

  if (!unused && seedInviteCodes) {
    const created = await secondaryClient.family.createInvite();
    const afterCreate = await secondaryClient.family.listInvites();
    unused = afterCreate.invites.find((invite) => invite.code === created.code) ?? {
      code: created.code,
      created_at: "",
      user_id: null,
    };
    source = "seeded";
  }

  if (!unused) {
    throw new Error(
      "Secondary account has no unused family-invite code. Re-run with --seed-invite-codes to intentionally create one.",
    );
  }

  const publicInvite = await publicClient.auth.getFamilyInvite(unused.code);

  return {
    code_length: unused.code.length,
    owner: publicInvite.owner,
    plan: publicInvite.plan,
    source,
  };
});

await runCheck("rss source fixture", async () => {
  const rssSourceUrl = readOptionalSecret("PUTIO_LIVE_RSS_SOURCE_URL");

  if (!rssSourceUrl) {
    throw new Error("Missing PUTIO_LIVE_RSS_SOURCE_URL.");
  }

  const created = await primaryClient.rss.create({
    dont_process_whole_feed: true,
    rss_source_url: rssSourceUrl,
    title: `codex sdk rss fixture ${Date.now()}`,
  });

  try {
    return {
      feed_id: created.id,
      rss_source_url: rssSourceUrl,
    };
  } finally {
    await primaryClient.rss.delete(created.id).catch(() => undefined);
  }
});

await runCheck("payment owner fixture", async () => {
  const ownerToken = readOptionalSecret("PUTIO_TOKEN_PAYMENT_OWNER") ?? tokens.firstPartyToken;
  const ownerClient = createClient({
    accessToken: ownerToken,
  });
  const [account, payment] = await Promise.all([
    ownerClient.account.getInfo({}),
    ownerClient.payment.getInfo(),
  ]);

  assertCondition(
    !account.is_sub_account,
    "Payment owner token must not belong to a family sub-account.",
  );
  assertCondition(
    payment.plan?.type === "onetime",
    "Payment owner fixture must be prepaid/onetime.",
  );

  return {
    plan_code: payment.plan?.code,
    token_source: readOptionalSecret("PUTIO_TOKEN_PAYMENT_OWNER")
      ? "PUTIO_TOKEN_PAYMENT_OWNER"
      : "PUTIO_TOKEN_FIRST_PARTY",
  };
});

await runCheck("payment sub-account fixture", async () => {
  const token = readOptionalSecret("PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT");

  if (!token) {
    throw new Error("Missing PUTIO_TOKEN_PAYMENT_SUB_ACCOUNT.");
  }

  const subAccountClient = createClient({
    accessToken: token,
  });
  const account = await subAccountClient.account.getInfo({});

  assertCondition(
    account.is_sub_account,
    "Payment sub-account token must belong to a family sub-account.",
  );

  try {
    await subAccountClient.payment.changePlan.preview({
      payment_type: "credit-card",
      plan_path: "1TB_365_once",
    });
    throw new Error("Expected sub-account payment preview to fail.");
  } catch (error) {
    if (!isRecord(error)) {
      throw error;
    }

    const reason = isRecord(error.reason) ? error.reason : {};

    assertCondition(error._tag === "PutioOperationError", "Expected PutioOperationError.");
    assertCondition(error.domain === "payment", "Expected payment domain.");
    assertCondition(
      error.operation === "previewChangePlan",
      "Expected previewChangePlan operation.",
    );
    assertCondition(
      reason.errorType === "PAYMENT_SUB_ACCOUNT_NOT_ALLOWED",
      "Expected PAYMENT_SUB_ACCOUNT_NOT_ALLOWED.",
    );
  }

  return {
    is_sub_account: account.is_sub_account,
  };
});

await runCheck("owned video fixture", async () => {
  const video = await requireOwnedVideoFixture(primaryClient);

  return {
    file_id: video.id,
    name: video.name,
  };
});

recordNotChecked("public-share quota fixture", {
  reason:
    "Public-share quota cannot be preflighted safely: creating a share consumes the same daily quota that the sharing live target needs.",
  verify_with: "vp pack && vp test run --config vitest.live.config.ts test/live/sharing.test.ts",
});

console.log(JSON.stringify({ checks }, null, 2));

const blocked = checks.filter((check) => check.status === "blocked");

if (blocked.length > 0) {
  process.exitCode = 1;
}
