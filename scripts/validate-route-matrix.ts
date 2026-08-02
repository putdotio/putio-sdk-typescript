import { readFile } from "node:fs/promises";

import { validateRouteMatrix } from "./route-matrix.ts";

const matrixUrl = new URL("../docs/api-route-matrix.json", import.meta.url);
const input: unknown = JSON.parse(await readFile(matrixUrl, "utf8"));
const { createPutioSdkEffectClient, createPutioSdkPromiseClient } =
  await import("../dist/index.js");

const promiseClient = createPutioSdkPromiseClient();
let failed = false;
let failure: unknown;

try {
  const matrix = validateRouteMatrix(input, {
    effect: createPutioSdkEffectClient(),
    promise: promiseClient,
  });
  const investigateCount = matrix.routes.filter(
    (route) => route.classification === "investigate",
  ).length;
  console.log(
    `Validated ${matrix.routes.length} public route decisions (${investigateCount} awaiting disposition).`,
  );
} catch (error) {
  failed = true;
  failure = error;
}

try {
  await promiseClient.dispose();
} catch (error) {
  if (!failed) {
    failed = true;
    failure = error;
  }
}

if (failed) {
  throw failure;
}
