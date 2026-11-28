import { describe, expect, it } from "vite-plus/test";

import { RouteMatrixValidationError, validateRouteMatrix } from "./route-matrix.ts";

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
    },
    {
      classification: "equivalent",
      method: "GET",
      operation: "files.get",
      path: "/v2/files/:fileId",
      rationale: "The client method uses an input object while preserving the route contract.",
    },
    {
      classification: "excluded",
      method: "GET",
      path: "/v2/docs",
      rationale: "Interactive backend documentation is not an SDK operation.",
    },
    {
      classification: "sdk",
      method: "GET",
      operation: "auth.grants",
      path: "/v2/oauth/grants/",
      rationale: "The trailing slash is part of the registered blueprint-root route.",
    },
    {
      classification: "investigate",
      followUp: "https://github.com/putdotio/putio-sdk-typescript/issues/108",
      method: "POST",
      path: "/v2/files/copy",
      rationale: "The public contract still needs an explicit SDK disposition.",
    },
  ],
  version: 1,
} as const;

describe("route matrix validation", () => {
  it("accepts every supported classification", () => {
    expect(validateRouteMatrix(JSON.stringify(validMatrix), clients)).toEqual(validMatrix);
  });

  it("rejects malformed, duplicate, and internal route evidence", () => {
    const invalid = {
      routes: [
        validMatrix.routes[0],
        validMatrix.routes[0],
        {
          classification: "excluded",
          method: "GET",
          path: "/v2/admin/users/<id>",
          rationale: " ",
        },
        {
          classification: "excluded",
          method: "GET",
          path: "/v2/",
          rationale: "A bare API prefix is not a public operation.",
        },
        {
          classification: "excluded",
          method: "GET",
          path: "/v2/files/../admin/users",
          rationale: "Dot navigation cannot turn a public-looking path into an internal route.",
        },
      ],
      version: 1,
    };

    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(
      RouteMatrixValidationError,
    );
    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(/duplicate route/);
    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(
      /canonical \/v2 path/,
    );
    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(/internal routes/);
    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(
      /rationale must not be empty/,
    );
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

    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(
      /Effect client is missing/,
    );
    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(
      /Promise client is missing/,
    );
    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(
      /excluded routes cannot declare an operation/,
    );
    expect(() => validateRouteMatrix(JSON.stringify(invalid), clients)).toThrow(
      /investigate routes require a repository issue URL/,
    );
  });

  it("does not validate forbidden operations against client surfaces", () => {
    const invalid = {
      routes: [
        {
          ...validMatrix.routes[2],
          operation: "files.missing",
        },
      ],
      version: 1,
    };

    try {
      validateRouteMatrix(JSON.stringify(invalid), clients);
      throw new Error("Expected route matrix validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RouteMatrixValidationError);

      if (!(error instanceof RouteMatrixValidationError)) {
        throw error;
      }

      expect(error.issues).toEqual([
        "routes[0] GET /v2/docs: excluded routes cannot declare an operation",
      ]);
    }
  });

  it("rejects unknown fields including private source pointers", () => {
    const withTypo = {
      ...validMatrix,
      routes: [
        {
          ...validMatrix.routes[0],
          operations: "account.getInfo",
        },
      ],
    };

    const withSource = {
      ...validMatrix,
      routes: [
        {
          ...validMatrix.routes[0],
          source: "backend/example.py:1",
        },
      ],
    };

    expect(() => validateRouteMatrix(JSON.stringify(withTypo), clients)).toThrow(/operations/);
    expect(() => validateRouteMatrix(JSON.stringify(withSource), clients)).toThrow(/source/);
  });
});
