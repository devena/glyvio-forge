# Example: Controller — HTTP Request Handlers

This example demonstrates how to create a **controller** in Glyvio. Controllers expose HTTP endpoints within your plugin, allowing external systems, the frontend, or the Glyvio orchestration layer to trigger server-side logic via API calls.

Common use cases include generating reports, processing form submissions, performing data lookups, executing batch operations, and serving raw computed responses (such as HTML dashboards).

---

## What `@Controller` Does

The `@glyvio_core.Controller` decorator registers a class as an HTTP handler under a unique URL path.

Key characteristics:

- **Path-based routing** — each controller maps a class to a unique route segment (e.g., `health_check` → `POST /controller/health_check`).
- **Access control** — you choose independently whether the endpoint is accessible from private (internal server) calls, public (external/unauthenticated) calls, or both.
- **Strictly typed I/O** — generics define the request body type (`T`) and response type (`R`), ensuring compile-time type safety.
- **Single method** — the entire logic is contained in the `handle(request)` method.

---

## Anatomy of `@Controller`

| Option               | Type      | Default | Description                                                             |
| -------------------- | --------- | ------- | ----------------------------------------------------------------------- |
| `path`               | `string`  | —       | Unique route identifier for this controller                             |
| `allowPrivateAccess` | `boolean` | `true`  | Whether this endpoint accepts calls from internal/private server routes |
| `allowPublicAccess`  | `boolean` | `false` | Whether this endpoint can be called without authentication              |

---

## Minimal Example: Health Check

A simple controller that returns a status object. No body is consumed; the response is always `{ status, timestamp }`.

```typescript
@glyvio_core.Controller({
  path: 'health_check',
  allowPrivateAccess: true,
  allowPublicAccess: true,
})
export class HealthCheckController extends glyvio_core.SimpleController<void, { status: string; timestamp: string }> {
  handle(_request: glyvio_core.WebRequest<void>): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
```

---

## Reading from the Database

Use `glyvio_core.queryService.find<T>()` to execute SQL queries and return typed results. This is the primary mechanism for fetching data within a controller.

```typescript
export interface SaleSummary {
  code: string;
  total_value: string;
  created_at: string;
}

@glyvio_core.Controller({
  path: 'list_open_sales',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class ListOpenSalesController extends glyvio_core.SimpleController<void, SaleSummary[]> {
  handle(_request: glyvio_core.WebRequest<void>): SaleSummary[] {
    return glyvio_core.queryService.find<SaleSummary>(
      `SELECT s.code, s.total_value, s.created_at
         FROM sale s
        WHERE s.status = 'open'
        ORDER BY s.created_at DESC`,
    );
  }
}
```

---

## Accepting a Request Body

Access the request payload via `request.body`. Always validate that the body is present before using it.
Throw a `glyvio_core.GlyvioError` for business-rule violations.

```typescript
export interface RegisterVisitRequest {
  /** The ID of the client being visited */
  clientId: string;
  /** Optional notes about the visit */
  notes?: string;
}

export interface RegisterVisitResponse {
  visitId: string;
  registeredAt: string;
}

@glyvio_core.Controller({
  path: 'register_visit',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class RegisterVisitController extends glyvio_core.SimpleController<RegisterVisitRequest, RegisterVisitResponse> {
  handle(request: glyvio_core.WebRequest<RegisterVisitRequest>): RegisterVisitResponse {
    const { body } = request;

    if (!body?.clientId) {
      throw new glyvio_core.GlyvioError({ message: 'clientId is required' });
    }

    const session = glyvio_core.sessionService.getCurrentSession();
    const visitId = glyvio_core.uuidService.v4();

    const visit = new glyvio_entity.Visit();
    visit.id = visitId;
    visit.clientId = body.clientId;
    visit.notes = body.notes ?? null;
    visit.userId = session.user.id;
    visit.userGroupId = session.user.id;
    visit.visitedAt = new Date().toISOString();

    glyvio_core.entityService.saveEntity(visit);

    return {
      visitId,
      registeredAt: visit.visitedAt,
    };
  }
}
```

---

## Saving Multiple Entities (Batch)

Use `EntityServiceQueue` and `glyvio_core.entityService.saveList()` for atomic multi-entity saves.

```typescript
export interface ImportTagsRequest {
  /** Array of tag names to import */
  names: string[];
  /** Entity scope for all created tags */
  entityName: string;
}

@glyvio_core.Controller({
  path: 'import_tags',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class ImportTagsController extends glyvio_core.SimpleController<ImportTagsRequest, { imported: number }> {
  handle(request: glyvio_core.WebRequest<ImportTagsRequest>): { imported: number } {
    const { body } = request;

    if (!body?.names?.length) {
      throw new glyvio_core.GlyvioError({ message: 'names array is required and must not be empty' });
    }

    const queue: glyvio_core.EntityServiceQueue = [];

    for (const name of body.names) {
      const tag = new glyvio_entity.Tag();
      tag.id = glyvio_core.uuidService.v4();
      tag.name = name;
      tag.entityName = body.entityName;
      tag.userGroupId = 'core_admin';
      queue.push(tag);
    }

    glyvio_core.entityService.saveList(queue);

    return { imported: queue.length };
  }
}
```

---

## Returning HTML (Report Dashboard)

Controllers can return raw HTML strings, which Glyvio renders directly in an embedded browser frame. This is ideal for rich, interactive reports.

```typescript
export interface SalesByRegionReport {
  state: string;
  total: number;
}

@glyvio_core.Controller({
  path: 'sales_by_region_report',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class SalesByRegionReportController extends glyvio_core.SimpleController<void, string> {
  handle(_request: glyvio_core.WebRequest<void>): string {
    const data = glyvio_core.queryService.find<SalesByRegionReport>(
      `SELECT a.state, SUM(s.total_value) AS total
         FROM sale s
         JOIN address a ON a.id = s.address_id
        GROUP BY a.state
        ORDER BY total DESC`,
    );

    return this.buildHtml(data);
  }

  private buildHtml(data: SalesByRegionReport[]): string {
    const rows = data
      .map(
        (r) => `<tr>
          <td>${r.state}</td>
          <td>R$ ${Number(r.total).toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales by Region</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
  <h1>Sales by Region</h1>
  <table>
    <thead><tr><th>State</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  }
}
```

---

## Using Permission Checks

Check if the requester is an admin or has a specific permission before executing sensitive operations.

```typescript
@glyvio_core.Controller({
  path: 'delete_all_test_data',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class DeleteAllTestDataController extends glyvio_core.SimpleController<void, { deleted: boolean }> {
  handle(_request: glyvio_core.WebRequest<void>): { deleted: boolean } {
    const isAdmin = glyvio_core.permissionService.isAdmin();

    if (!isAdmin) {
      throw new glyvio_core.GlyvioError({ message: 'Only administrators can perform this operation' });
    }

    // ... perform the operation ...

    return { deleted: true };
  }
}
```

---

## Key Architectural Points

| Concept                                     | Detail                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@glyvio_core.Controller`                   | Registers the class under a unique `path` in the controller registry                              |
| `glyvio_core.SimpleController<T, R>`        | Base class to extend. `T` = request body type, `R` = response type. Implement `handle(request)`.  |
| `glyvio_core.WebRequest<T>`                 | Carries `body?: T`, `requestParams`, and `method` for the incoming HTTP request                   |
| `glyvio_core.queryService.find<T>(sql)`     | Executes a SQL query and returns an array of typed results                                        |
| `glyvio_core.entityService.saveEntity(e)`   | Saves a single entity with permission checks                                                      |
| `glyvio_core.entityService.saveList(queue)` | Saves multiple entities in one batch with permission checks                                       |
| `glyvio_core.GlyvioError`                   | The standard error type for business rule violations (no try/catch wrapping needed)               |
| `glyvio_core.sessionService`                | Provides the current user and company from the active session                                     |
| No imports                                  | All symbols (`glyvio_core`, `glyvio_entity`, etc.) are globally injected and must NOT be imported |
