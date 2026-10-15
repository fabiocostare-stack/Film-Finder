---
name: Orval path-parameter export collision
description: A code-generation quirk where GET operations with path parameters can produce duplicate exported TypeScript names.
---

When Orval generates a GET operation with a path parameter, its Zod query/parameter schema and generated TypeScript parameter type can share an export name, causing `TS2308` in the `@workspace/api-zod` barrel.

**Why:** The current Orval output layout re-exports both generated schema and model/type files through the same barrel.

**How to apply:** If a route can reasonably accept an identifier as a query parameter, prefer that shape over a path parameter to avoid this collision; rerun codegen and the library typecheck after changing the OpenAPI spec.
