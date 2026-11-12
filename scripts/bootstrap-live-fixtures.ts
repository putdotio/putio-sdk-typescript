import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { Option, Schema } from "effect";

import { requireOwnedVideoFixture } from "../test/live/support/media.ts";
import { readLiveTokens, readOptionalSecret } from "../test/live/support/secrets.ts";

type FixtureCheckStatus = "blocked" | "not_checked" | "passed";

type FixtureDetailValue = boolean | number | string | null | undefined;

type FixtureDetails = Readonly<Record<string, FixtureDetailValue>>;

type FixtureCheck = {
  readonly details?: FixtureDetails;
  readonly name: string;
  readonly status: FixtureCheckStatus;
};

const seedInviteCodes = process.argv.includes("--seed-invite-codes");

const buildResult = spawnSync("vp", ["pack"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const { createPutioSdkPromiseClient: createClient } = await import("../dist/index.js");
const { getSecondaryClient } = await import("../test/live/support/bootstrap.ts");
const { requireLiveFriendWithSharedFiles } = await import("../test/live/support/friends.ts");

const checks: FixtureCheck[] = [];

const TypedErrorSummarySchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  domain: Schema.optional(Schema.String),
  operation: Schema.optional(Schema.String),
  reason: Schema.optional(
    Schema.Struct({
      errorType: Schema.optional(Schema.String),
    }),
  ),
  status: Schema.optional(Schema.Number),
});

const decodeTypedErrorSummary = Schema.decodeUnknownOption(TypedErrorSummarySchema);

const isSubAccountPaymentRejection = Schema.is(
  Schema.TaggedStruct("PutioOperationError", {
    domain: Schema.Literal("payment"),
    operation: Schema.Literal("previewChangePlan"),
    reason: Schema.Struct({ errorType: Schema.Literal("PAYMENT_SUB_ACCOUNT_NOT_ALLOWED") }),
  }),
);

const errorMessage = (cause: unknown): string => {
  const summary = decodeTypedErrorSummary(cause);

  if (Option.isSome(summary)) {
    const { _tag, domain, operation, reason, status } = summary.value;

    const typedError = [
      _tag,
      domain,
      operation,
      status === undefined ? undefined : String(status),
      reason?.errorType,
    ].filter((part) => part !== undefined);

    if (typedError.length > 0) {
      return typedError.join(" ");
    }
  }

  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }

  return String(cause);
};

const runCheck = async (name: string, fn: () => Promise<FixtureDetails>): Promise<void> => {
  try {
    checks.push({ details: await fn(), name, status: "passed" });
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

const recordNotChecked = (name: string, details: FixtureDetails): void => {
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

await runCheck("friend/share secondary fixture", async () => {
  const friend = await requireLiveFriendWithSharedFiles(primaryClient);

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
    title: `putio-typescript-sdk rss fixture ${Date.now()}`,
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
  const ownerToken = readOptionalSecret("PUTIO_TOKEN_PAYMENT_OWNER");

  const ownerClient = createClient({
    accessToken: ownerToken ?? tokens.firstPartyToken,
  });

  const [account, payment] = await Promise.all([
    ownerClient.account.getInfo({}),
    ownerClient.payment.getInfo(),
  ]);

  assert(!account.is_sub_account, "Payment owner token must not belong to a family sub-account.");
  assert(payment.plan?.type === "onetime", "Payment owner fixture must be prepaid/onetime.");

  return {
    plan_code: payment.plan?.code,
    token_source: ownerToken ? "PUTIO_TOKEN_PAYMENT_OWNER" : "PUTIO_TOKEN_FIRST_PARTY",
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

  assert(account.is_sub_account, "Payment sub-account token must belong to a family sub-account.");

  const failure = await subAccountClient.payment.changePlan
    .preview({ payment_type: "credit-card", plan_path: "1TB_365_once" })
    .then(
      () => {
        throw new Error("Expected sub-account payment preview to fail.");
      },
      (cause: unknown) => cause,
    );

  assert(
    isSubAccountPaymentRejection(failure),
    `Expected payment previewChangePlan PAYMENT_SUB_ACCOUNT_NOT_ALLOWED, got ${errorMessage(failure)}`,
  );

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
