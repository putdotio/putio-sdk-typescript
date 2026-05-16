import { createPutioSdkPromiseClient, type PutioSdkPromiseClient } from "../../../dist/index.js";

export const createPromiseClient = async (
  config: Record<string, unknown> = {},
): Promise<PutioSdkPromiseClient> => createPutioSdkPromiseClient(config);
