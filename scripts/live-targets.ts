import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const CREDENTIAL_BACKED_TARGETS = new Set([
  "auth-credentials.test.ts",
  "family.test.ts",
  "friend-invites.test.ts",
  "friends.test.ts",
  "podcast.test.ts",
  "sharing.test.ts",
]);

export const resolveLiveTestTargets = (
  targets: ReadonlyArray<string>,
  cwd = process.cwd(),
): ReadonlyArray<string> => {
  const liveRoot = resolve(cwd, "test/live");

  return targets.map((target) => {
    const resolvedTarget = resolve(cwd, target);
    const relativeTarget = relative(liveRoot, resolvedTarget);
    const isLiveTest =
      relativeTarget.endsWith(".test.ts") &&
      relativeTarget !== ".." &&
      !relativeTarget.startsWith(`..${sep}`) &&
      !isAbsolute(relativeTarget);

    if (!isLiveTest || !existsSync(resolvedTarget)) {
      throw new Error(`Unsupported live test target: ${target}`);
    }

    if (CREDENTIAL_BACKED_TARGETS.has(relativeTarget)) {
      throw new Error(`Credential-backed target is not allowed: ${target}`);
    }

    return resolvedTarget;
  });
};
