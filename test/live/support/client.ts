import {
  createPutioSdkPromiseClient,
  type createPutioSdkPromiseClient as CreatePutioSdkPromiseClient,
} from "../../../src/index.js";

type PutioSdkPromiseClient = ReturnType<typeof CreatePutioSdkPromiseClient>;

export const createPromiseClient = async (
  config: Record<string, unknown> = {},
): Promise<PutioSdkPromiseClient> => createPutioSdkPromiseClient(config);
