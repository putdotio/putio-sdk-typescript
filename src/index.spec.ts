import { describe, expect, it } from "vite-plus/test";

import * as sdk from "./index.js";

describe("sdk root entry", () => {
  it("exports the expected top-level public surface", () => {
    expect(sdk).toMatchObject({
      PutioConfigurationError: expect.any(Function),
      PutioOperationError: expect.any(Function),
      PutioValidationError: expect.any(Function),
      buildPutioUrl: expect.any(Function),
      createPutioSdkEffectClient: expect.any(Function),
      createPutioSdkPromiseClient: expect.any(Function),
      getAccountInfo: expect.any(Function),
      getCode: expect.any(Function),
      getConfigKey: expect.any(Function),
      getFile: expect.any(Function),
      getPaymentInfo: expect.any(Function),
      getTransfer: expect.any(Function),
      listEvents: expect.any(Function),
      listPublicShares: expect.any(Function),
      listRssFeeds: expect.any(Function),
      listTunnelRoutes: expect.any(Function),
      listZips: expect.any(Function),
      makePutioSdkLiveLayer: expect.any(Function),
      requestArrayBuffer: expect.any(Function),
      requestJson: expect.any(Function),
      requestVoid: expect.any(Function),
      uploadFile: expect.any(Function),
      writeConfig: expect.any(Function),
    });

    expect(Object.keys(sdk)).toEqual(
      expect.arrayContaining(["getAccountInfo", "getFile", "uploadFile"]),
    );
  });
});
