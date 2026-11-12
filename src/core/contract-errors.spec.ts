import { Effect, Layer, Schema } from "effect";
import { afterEach, assert, describe, expect, it, vi } from "@effect/vitest";

import { expectFailure } from "../../test/support/sdk-test.js";
import { login } from "../domains/auth.js";
import { createPutioSdkPromiseClient } from "./client.js";
import {
  PutioContractError,
  PutioTransportError,
  isPutioContractError,
  isPutioTransportError,
  isPutioValidationError,
} from "./errors.js";
import { OkResponseSchema, makePutioFetchLayer, putioSdkLayer, requestJson } from "./http.js";

const loginInput = {
  clientId: 1,
  clientSecret: "client-secret",
  password: "password",
  username: "user",
};

const privateLoginBody = JSON.stringify({ access_token: ["private-token"], user_id: 7 });

const respondWith =
  (body: BodyInit | null, status = 200): typeof fetch =>
  async () =>
    new Response(body, { status });

const fetchSdkLayer = (body: BodyInit | null) =>
  Layer.mergeAll(makePutioFetchLayer(respondWith(body)), putioSdkLayer({}));

const serialized = (error: Error) =>
  [
    JSON.stringify(error),
    JSON.stringify(Schema.encodeUnknownSync(Schema.Defect())(error)),
    String(error),
  ].join("\n");

describe("response contract errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect.each(["<html>private response</html>", "", '{"access_token":"private response"'])(
    "maps a success body that is not JSON to PutioContractError: %s",
    (body) =>
      Effect.gen(function* () {
        const error = expectFailure(
          yield* Effect.exit(
            requestJson(OkResponseSchema, {
              method: "GET",
              path: "/test",
              auth: { type: "none" },
            }).pipe(Effect.provide(fetchSdkLayer(body))),
          ),
        );

        expect(error).toBeInstanceOf(PutioContractError);
        expect(error).toMatchObject({ cause: expect.any(SyntaxError) });
        expect(isPutioContractError(error)).toBe(true);
        expect(isPutioTransportError(error)).toBe(false);
        expect(serialized(error)).not.toContain("private response");
      }),
  );

  it.effect("keeps a success body that cannot be read a transport error", () =>
    Effect.gen(function* () {
      const cause = new TypeError("body connection lost");

      const body = new ReadableStream({
        start(controller) {
          controller.error(cause);
        },
      });

      const error = expectFailure(
        yield* Effect.exit(
          requestJson(OkResponseSchema, {
            method: "GET",
            path: "/test",
            auth: { type: "none" },
          }).pipe(Effect.provide(fetchSdkLayer(body))),
        ),
      );

      expect(error).toBeInstanceOf(PutioTransportError);
      expect(error).toHaveProperty("cause", cause);
    }),
  );

  it.effect("keeps token endpoint response values out of the Effect client's contract error", () =>
    Effect.gen(function* () {
      const error = expectFailure(
        yield* Effect.exit(login(loginInput).pipe(Effect.provide(fetchSdkLayer(privateLoginBody)))),
      );

      expect(error).toBeInstanceOf(PutioContractError);
      expect(isPutioContractError(error)).toBe(true);
      expect(isPutioValidationError(error)).toBe(false);
      expect(serialized(error)).toContain("access_token");
      expect(serialized(error)).not.toContain("private-token");
    }),
  );

  it("rejects the Promise client with the same contract error", async () => {
    vi.stubGlobal("fetch", respondWith(privateLoginBody));

    const error: unknown = await createPutioSdkPromiseClient()
      .auth.login(loginInput)
      .catch((cause: unknown) => cause);

    expect(isPutioContractError(error)).toBe(true);
    assert.instanceOf(error, PutioContractError);
    expect(serialized(error)).not.toContain("private-token");
  });
});
