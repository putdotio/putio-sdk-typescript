import { Schema } from "effect";

const RouteMethodSchema = Schema.Literals(["DELETE", "GET", "PATCH", "POST", "PUT"]);
const RouteClassificationSchema = Schema.Literals(["equivalent", "excluded", "investigate", "sdk"]);

const RouteDecisionSchema = Schema.Struct({
  classification: RouteClassificationSchema,
  followUp: Schema.optional(Schema.String),
  method: RouteMethodSchema,
  operation: Schema.optional(Schema.String),
  path: Schema.String,
  rationale: Schema.String,
  source: Schema.String,
});

export const RouteMatrixSchema = Schema.Struct({
  routes: Schema.Array(RouteDecisionSchema),
  version: Schema.Literal(1),
});

export type RouteMatrix = Schema.Schema.Type<typeof RouteMatrixSchema>;

export interface RouteMatrixClientSurfaces {
  readonly effect: unknown;
  readonly promise: unknown;
}

export class RouteMatrixValidationError extends Error {
  readonly issues: ReadonlyArray<string>;

  constructor(issues: ReadonlyArray<string>) {
    super(`Route matrix validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "RouteMatrixValidationError";
    this.issues = issues;
  }
}

const canonicalPathPattern = /^\/v2(?:\/(?:[a-z0-9._~-]+|:[A-Za-z][A-Za-z0-9]*))*$/;
const operationPattern = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;
const sourcePattern = /^[A-Za-z0-9._/-]+\.py:[1-9][0-9]*$/;
const followUpPattern =
  /^https:\/\/github\.com\/putdotio\/putio-sdk-typescript\/issues\/[1-9][0-9]*$/;
const internalPrefixes = ["/v2/admin", "/v2/private"];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const resolveOperation = (surface: unknown, operation: string): unknown => {
  let current = surface;
  for (const segment of operation.split(".")) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
};

const validateClassification = (
  route: RouteMatrix["routes"][number],
  index: number,
): ReadonlyArray<string> => {
  const location = `routes[${index}] ${route.method} ${route.path}`;
  const issues: Array<string> = [];

  if (route.classification === "sdk" || route.classification === "equivalent") {
    if (route.operation === undefined) {
      issues.push(`${location}: ${route.classification} routes require an operation`);
    }
  } else if (route.operation !== undefined) {
    issues.push(`${location}: ${route.classification} routes cannot declare an operation`);
  }

  if (route.classification === "investigate") {
    if (route.followUp === undefined || !followUpPattern.test(route.followUp)) {
      issues.push(`${location}: investigate routes require a repository issue URL`);
    }
  } else if (route.followUp !== undefined) {
    issues.push(`${location}: only investigate routes can declare followUp`);
  }

  return issues;
};

export const validateRouteMatrix = (
  input: unknown,
  clients: RouteMatrixClientSurfaces,
): RouteMatrix => {
  let matrix: RouteMatrix;
  try {
    matrix = Schema.decodeUnknownSync(RouteMatrixSchema, {
      errors: "all",
      onExcessProperty: "error",
    })(input);
  } catch (cause) {
    throw new RouteMatrixValidationError([`schema: ${String(cause)}`]);
  }

  const issues: Array<string> = [];
  const routes = new Set<string>();

  for (const [index, route] of matrix.routes.entries()) {
    const location = `routes[${index}] ${route.method} ${route.path}`;
    const key = `${route.method} ${route.path}`;

    if (routes.has(key)) {
      issues.push(`${location}: duplicate route`);
    }
    routes.add(key);

    if (!canonicalPathPattern.test(route.path)) {
      issues.push(`${location}: path must be a canonical /v2 path`);
    }
    if (
      internalPrefixes.some(
        (prefix) => route.path === prefix || route.path.startsWith(`${prefix}/`),
      )
    ) {
      issues.push(`${location}: internal routes do not belong in the public matrix`);
    }
    if (route.rationale.trim().length === 0) {
      issues.push(`${location}: rationale must not be empty`);
    }
    if (
      !sourcePattern.test(route.source) ||
      route.source.startsWith("/") ||
      route.source.includes("..") ||
      route.source.includes("\\")
    ) {
      issues.push(`${location}: source must be a backend-relative Python file and line`);
    }

    issues.push(...validateClassification(route, index));

    if (route.operation !== undefined) {
      if (!operationPattern.test(route.operation)) {
        issues.push(`${location}: operation must be a dotted client method path`);
      } else {
        if (typeof resolveOperation(clients.effect, route.operation) !== "function") {
          issues.push(`${location}: Effect client is missing ${route.operation}`);
        }
        if (typeof resolveOperation(clients.promise, route.operation) !== "function") {
          issues.push(`${location}: Promise client is missing ${route.operation}`);
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new RouteMatrixValidationError(issues);
  }

  return matrix;
};
