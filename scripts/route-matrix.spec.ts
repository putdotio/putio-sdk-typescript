import { describe, expect, it } from "vite-plus/test";

import { RouteMatrixValidationError, validateRouteMatrix } from "./route-matrix.mts";

const clients = {
  effect: {
    account: {
      getInfo: () => undefined,
    },
    auth: {
      grants: () => undefined,
    },
    files: {
      copy: () => undefined,
      get: () => undefined,
    },
  },
  promise: {
    account: {
      getInfo: () => undefined,
    },
    auth: {
      grants: () => undefined,
    },
    files: {
      copy: () => undefined,
      get: () => undefined,
    },
  },
};

const validMatrix = {
  routes: [
    {
      classification: "sdk",
      method: "GET",
      operation: "account.getInfo",
      path: "/v2/account/info",
      rationale: "The SDK exposes the backend account-info contract directly.",
      source: "putio/api2/account.py:137",
    },
    {
      classification: "equivalent",
      method: "GET",
      operation: "files.get",
      path: "/v2/files/:fileId",
      rationale: "The client method uses an input object while preserving the route contract.",
      source: "putio/api2/files.py:832",
    },
    {
      classification: "excluded",
      method: "GET",
      path: "/v2/docs",
      rationale: "Interactive backend documentation is not an SDK operation.",
      source: "putio/api2/documentation.py:6",
    },
    {
      classification: "sdk",
      method: "GET",
      operation: "auth.grants",
      path: "/v2/oauth/grants/",
      rationale: "The trailing slash is part of the registered blueprint-root route.",
      source: "putio/api2/oauth_grants.py:28",
    },
    {
      classification: "investigate",
      followUp: "https://github.com/putdotio/putio-sdk-typescript/issues/108",
      method: "POST",
      path: "/v2/files/copy",
      rationale: "The public contract still needs an explicit SDK disposition.",
      source: "putio/api2/files.py:1381",
    },
  ],
  version: 1,
} as const;

describe("route matrix validation", () => {
  it("accepts every supported classification", () => {
    expect(validateRouteMatrix(validMatrix, clients)).toEqual(validMatrix);
  });

  it("rejects malformed, duplicate, internal, and absolute route evidence", () => {
    const invalid = {
      routes: [
        validMatrix.routes[0],
        validMatrix.routes[0],
        {
          classification: "excluded",
          method: "GET",
          path: "/v2/admin/users/<id>",
          rationale: " ",
          source: "/Users/maintainer/putio/api2/admin.py:1",
        },
        {
          classification: "excluded",
          method: "GET",
          path: "/v2/",
          rationale: "A bare API prefix is not a public operation.",
          source: "putio/app.py:1",
        },
      ],
      version: 1,
    };

    expect(() => validateRouteMatrix(invalid, clients)).toThrow(RouteMatrixValidationError);
    expect(() => validateRouteMatrix(invalid, clients)).toThrow(/duplicate route/);
    expect(() => validateRouteMatrix(invalid, clients)).toThrow(/canonical \/v2 path/);
    expect(() => validateRouteMatrix(invalid, clients)).toThrow(/internal routes/);
    expect(() => validateRouteMatrix(invalid, clients)).toThrow(/rationale must not be empty/);
    expect(() => validateRouteMatrix(invalid, clients)).toThrow(/backend-relative/);
  });

  it("rejects invalid classification fields and missing client methods", () => {
    const invalid = {
      routes: [
        {
          ...validMatrix.routes[0],
          operation: "account.missing",
        },
        {
          ...validMatrix.routes[2],
          operation: "files.get",
        },
        {
          ...validMatrix.routes[4],
          followUp: "https://github.com/putdotio/other/issues/1",
        },
      ],
      version: 1,
    };

    expect(() => validateRouteMatrix(invalid, clients)).toThrow(/Effect client is missing/);
    expect(() => validateRouteMatrix(invalid, clients)).toThrow(/Promise client is missing/);
    expect(() => validateRouteMatrix(invalid, clients)).toThrow(
      /excluded routes cannot declare an operation/,
    );
    expect(() => validateRouteMatrix(invalid, clients)).toThrow(
      /investigate routes require a repository issue URL/,
    );
  });

  it("rejects unknown fields instead of silently dropping typos", () => {
    const invalid = {
      ...validMatrix,
      routes: [
        {
          ...validMatrix.routes[0],
          operations: "account.getInfo",
        },
      ],
    };

    expect(() => validateRouteMatrix(invalid, clients)).toThrow(/operations/);
  });
});
