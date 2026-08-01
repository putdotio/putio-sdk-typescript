import { readFile } from "node:fs/promises";

import { validateRouteMatrix } from "./route-matrix.mts";

const matrixUrl = new URL("../docs/api-route-matrix.json", import.meta.url);
const input: unknown = JSON.parse(await readFile(matrixUrl, "utf8"));
const { createPutioSdkEffectClient, createPutioSdkPromiseClient } =
  await import("../dist/index.js");

const promiseClient = createPutioSdkPromiseClient();

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
} finally {
  await promiseClient.dispose();
}
