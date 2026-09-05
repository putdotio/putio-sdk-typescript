export const httpCompatibilitySource = `
import { Cause as HttpCause, Effect as HttpEffect, Exit as HttpExit, Fiber as HttpFiber } from "effect";
import { createPutioSdkEffectClient as httpSdk, makePutioFetchLayer as httpLayer, makePutioSdkLayer as httpConfig, makePutioFetchClient as httpFetch } from "@putdotio/sdk";

const runHttpCompatibility = async () => {
  for (const status of [401, 403, 429, 502]) {
    for (const body of ["<html>private response</html>", "", "{invalid"]) {
      const exit = await HttpEffect.runPromiseExit(
        httpSdk().events.clear().pipe(
          HttpEffect.provide(httpConfig({ accessToken: "fixture-token" })),
          HttpEffect.provide(httpLayer(async () => new Response(body, {
            status,
            headers: { "retry-after": "60" },
          }))),
        ),
      );
      if (HttpExit.isSuccess(exit)) throw new Error("Expected HTTP failure");
      const error = exit.cause.reasons.find(HttpCause.isFailReason)?.error;
      const expectedTag = status === 429 ? "PutioRateLimitError" : status === 502 ? "PutioApiError" : "PutioAuthError";
      if (!error || error._tag !== expectedTag || !("status" in error) || error.status !== status) {
        throw new Error("HTTP classification lost: " + JSON.stringify(error));
      }
      if (!("cause" in error) || !(error.cause instanceof SyntaxError)) throw new Error("Missing parsing cause");
      if (JSON.stringify(error).includes("private response")) throw new Error("Response body leaked");
      if (error._tag === "PutioRateLimitError" && error.retryAfter !== "60") throw new Error("Retry-After lost");
    }
  }
};
const runHttpCancellationCompatibility = async (url: string) => {
  for (const kind of ["json", "arrayBuffer", "error"] as const) {
    let startReading: (() => void) | undefined;
    const started = new Promise<void>((resolve) => { startReading = resolve; });
    let observedSignal: AbortSignal | undefined;
    let bodyRead: Promise<unknown> | undefined;
    const client = httpFetch(async (input, init) => {
      observedSignal = init?.signal ?? undefined;
      const response = await fetch(input, init);
      const read = kind === "arrayBuffer" ? response.arrayBuffer.bind(response) : kind === "error" ? response.text.bind(response) : response.json.bind(response);
      const observe = () => {
        bodyRead = read();
        // Observe rejection immediately, including during fiber interruption.
        void bodyRead.catch(() => undefined);
        startReading?.();
        return bodyRead;
      };
      if (kind === "arrayBuffer") response.arrayBuffer = () => observe().then((value) => {
        if (!(value instanceof ArrayBuffer)) throw new Error("Expected binary body");
        return value;
      });
      else if (kind === "error") response.text = () => observe().then((value) => {
        if (typeof value !== "string") throw new Error("Expected text body");
        return value;
      });
      else response.json = observe;
      return response;
    });
    const fiber = HttpEffect.runFork(client.execute({
      headers: new Headers(), method: "GET", url: url + (kind === "error" ? "/error" : "/body"),
    }).pipe(HttpEffect.flatMap((response) => kind === "arrayBuffer" ? response.arrayBuffer : response.json)));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([started, new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Body read did not start")), 5_000);
      })]);
      await HttpEffect.runPromise(HttpFiber.interrupt(fiber));
      if (!observedSignal?.aborted) throw new Error("Fetch signal was not aborted during " + kind);
      const outcome = await bodyRead?.then(() => "completed", (error: unknown) => error);
      if (!(outcome instanceof Error) || outcome.name !== "AbortError") throw new Error("Native body read did not abort: " + String(outcome));
    } finally {
      clearTimeout(timeout);
      await HttpEffect.runPromise(HttpFiber.interrupt(fiber));
    }
  }
};
`;
