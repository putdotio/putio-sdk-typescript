import { createPutioSdkPromiseClient, type PutioSdkPromiseClient } from "../../../dist/index.js";

export const createPromiseClient = async (
  config: Parameters<typeof createPutioSdkPromiseClient>[0] = {},
): Promise<PutioSdkPromiseClient> => createPutioSdkPromiseClient(config);
