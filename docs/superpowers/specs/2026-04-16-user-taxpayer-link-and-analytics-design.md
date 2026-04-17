# User-Taxpayer Link & Spending Analytics

**Date:** 2026-04-16
**Status:** Approved

---

## Overview

Two features:
1. Link each user to their own `Taxpayer` record (1:1), surface `nrc`, `nit`, `nombre` in the JWT.
2. New `analytics` module exposing a spending/sales summary endpoint grouped by category, with prior-period comparison.

---

## Feature 1: User ↔ Taxpayer Link

### Data Model

Add optional FK on `users` table:

```prisma
model User {
  // ... existing fields
  taxpayerId  String?   @unique @map("taxpayer_id")
  taxpayer    Taxpayer? @relation(fields: [taxpayerId], references: [id])
}

model Taxpayer {
  // ... existing fields
  user  User?
}
```

Migration: `add_user_taxpayer_relation`
- Adds nullable `taxpayer_id` column to `users`
- Adds unique constraint on `taxpayer_id`

### Linking Endpoint

```
PATCH /users/:id/taxpayer
Body: { nrc: string }
Auth: JWT required
```

- Looks up `Taxpayer` by `nrc`
- Sets `user.taxpayerId = taxpayer.id`
- Returns updated user object
- 404 if taxpayer not found by nrc

### Auth / JWT Changes

**Login handler** — after resolving user, if `user.taxpayerId` exists, include taxpayer in response:

```ts
// JWT payload
{
  sub: user.id,
  email: user.email,
  taxpayer: { nrc: string, nit: string | null, nombre: string } | undefined
}

// Login response body
{
  access_token: string,
  user: {
    id, email, name, avatarUrl,
    taxpayer: { nrc, nit, nombre } | undefined
  }
}
```

**JwtStrategy** — no changes. Validates by email only. `taxpayer` in JWT is frontend read-only.

**PrismaUserAdapter** — all find methods include `taxpayer: true` in Prisma `include`. `mapToDomain` passes `taxpayerId` through to `User` entity.

**User domain entity** — add `taxpayerId?: string` field.

---

## Feature 2: Spending Analytics

### Module Structure

```
src/modules/analytics/
  domain/
    ports/analytics-repository.port.ts
  application/
    queries/get-spending/
      get-spending.query.ts
      get-spending.handler.ts
  infrastructure/
    adapters/prisma-analytics.adapter.ts
    http/analytics.controller.ts
  analytics.module.ts
```

### Endpoint

```
GET /analytics/spending?year=2025&month=3&type=purchase|sale|all
Auth: JWT required
```

- `year` — required
- `month` — optional (1–12); if omitted, aggregates full year
- `type` — optional, defaults to `all`

NRC extracted from `req.user.taxpayer.nrc` (decoded JWT). Returns **403** if user has no linked taxpayer.

### Period Logic

| Query params | Current period | Comparison period |
|---|---|---|
| year + month | year/month | year/month-1 (wraps to prev year if month=1) |
| year only | year | year-1 |

### Category Aggregation

`Dte.itemsCategory` is `Json` storing a `string[]` (e.g. `["gasolina"]`). Prisma `groupBy` cannot aggregate nested JSON. Use `prisma.$queryRaw` with `jsonb_array_elements_text` to unnest and group by category name.

`issue_date` is stored as `'YYYY-MM-DD'` string — cast to date in SQL: `issue_date::date`.

Purchase DTEs: `receiver_nrc = $1`
Sale DTEs: `issuer_nrc = $1`

For `type=all`: run both queries separately and return them as distinct arrays under `purchase` and `sale` keys.

Aggregate per category: `SUM(amount_due)` as total, `COUNT(*)` as count.

### Response Shape

**type=purchase or type=sale:**
```json
{
  "period": { "year": 2025, "month": 3, "type": "purchase" },
  "categories": [
    { "name": "gasolina", "total": 1500.00, "count": 8 }
  ],
  "comparison": {
    "period": { "year": 2025, "month": 2 },
    "categories": [
      { "name": "gasolina", "total": 900.00, "count": 5 }
    ]
  }
}
```

**type=all:**
```json
{
  "period": { "year": 2025, "month": 3, "type": "all" },
  "purchase": {
    "categories": [{ "name": "gasolina", "total": 1500.00, "count": 8 }],
    "comparison": { "period": { "year": 2025, "month": 2 }, "categories": [] }
  },
  "sale": {
    "categories": [{ "name": "Publicidad", "total": 3000.00, "count": 4 }],
    "comparison": { "period": { "year": 2025, "month": 2 }, "categories": [] }
  }
}
```

---

## Out of Scope

- Admin role guard on `PATCH /users/:id/taxpayer` (add later)
- Auto-linking by email at login
- Pagination or top-N limits on categories
- Caching analytics results
