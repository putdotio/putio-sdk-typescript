import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

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

    return resolvedTarget;
  });
};
