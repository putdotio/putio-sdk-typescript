import { createPutioSdkPromiseClient, type PutioSdkPromiseClient } from "../../../dist/index.js";
import { hydrateLiveTokenEnv, readLiveTokens, type PutioLiveTokens } from "./secrets.ts";

export type LiveTokenClients = {
  readonly authClient: PutioSdkPromiseClient;
  readonly oauthClient: PutioSdkPromiseClient;
  readonly tokens: PutioLiveTokens;
};

export const createLiveTokenClients = (): LiveTokenClients => {
  hydrateLiveTokenEnv();

  const tokens = readLiveTokens();

  return {
    authClient: createPutioSdkPromiseClient({
      accessToken: tokens.firstPartyToken,
    }),
    oauthClient: createPutioSdkPromiseClient({
      accessToken: tokens.thirdPartyToken,
    }),
    tokens,
  };
};
