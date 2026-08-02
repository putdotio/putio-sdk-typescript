# Migrating to v11

Version 11 removes two public contracts that did not correspond to supported backend behavior.

## Coinbase charge creation

The backend no longer exposes Coinbase charge creation. Version 11 removes:

- `payment.methods.createCoinbaseCharge` from the Effect and Promise clients
- `createCoinbaseCharge`
- `CreateCoinbaseChargeErrorSpec`
- `CreateCoinbaseChargeError`

Use `payment.listOptions()` and `payment.listPlans()` to select a currently supported payment
path. `payment.methods.createOpenNodeCharge(planPath)` remains available when OpenNode is the
selected cryptocurrency provider.

## File-search type filter

The backend file-search route accepts `query` and `per_page`; it does not apply a `type` filter.
Version 11 therefore removes `type` from `FilesSearchQuery` and stops serializing it.

Before:

```ts
await sdk.files.search({
  query: "vacation",
  type: ["VIDEO", "IMAGE"],
});
```

After:

```ts
await sdk.files.search({
  query: "vacation",
  per_page: 100,
});
```

Consumers may narrow the returned page for presentation, but that does not produce a
server-filtered total or cursor. A complete type-filtered search requires backend support.

## Upgrade checklist

1. Remove Coinbase charge calls and choose a provider returned by the payment APIs.
2. Remove `type` from file-search inputs.
3. Recompile against the packed v11 package to catch stale methods, types, and exports.
