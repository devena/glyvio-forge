---
name: create-controller
description: 'Generates a typed class extending SimpleController, registers it via the @Controller decorator, and wires it into the server entrypoint. The controller exposes an HTTP endpoint for triggering server-side business logic, running queries, saving entities, or rendering HTML reports.'
---

# Agent Skill: Create Controller in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to generate and register a server-side HTTP request handler (`SimpleController`) in the `plugin/server` layer of a Glyvio plugin.

---

## 🎯 Skill Metadata

```json
{
  "name": "create_controller",
  "description": "Generates a typed class extending SimpleController, registers it via the @Controller decorator, and wires it into the server entrypoint. The controller exposes an HTTP endpoint for triggering server-side business logic, running queries, saving entities, or rendering HTML reports.",
  "Audience": "AI agents or developers with write access to a Glyvio plugin codebase.",
  "parameters": {
    "type": "object",
    "properties": {
      "controllerId": {
        "type": "string",
        "description": "Unique snake_case path identifier for this controller (e.g., register_visit, generate_sales_report)"
      },
      "className": {
        "type": "string",
        "description": "PascalCase class name with the Controller suffix (e.g., RegisterVisitController)"
      },
      "requestBodyType": {
        "type": "string",
        "description": "TypeScript type or interface name for the request body. Use 'void' if no body is expected."
      },
      "responseType": {
        "type": "string",
        "description": "TypeScript type or interface name for the response (e.g., RegisterVisitResponse, string for HTML, void)"
      },
      "allowPublicAccess": {
        "type": "boolean",
        "description": "Whether this endpoint can be called without authentication. Defaults to false."
      },
      "allowPrivateAccess": {
        "type": "boolean",
        "description": "Whether this endpoint accepts calls from internal/private server routes. Defaults to true."
      }
    },
    "required": ["controllerId", "className", "requestBodyType", "responseType"]
  }
}
```

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Controller ID** (e.g., `register_visit`): Unique snake_case route identifier registered in the controller registry.
2. **Controller Class Name** (e.g., `RegisterVisitController`): PascalCase class name.
3. **Request Body Type** (e.g., `RegisterVisitRequest` or `void`): The TypeScript shape of the incoming HTTP request body.
4. **Response Type** (e.g., `RegisterVisitResponse`, `string` for HTML, or `void`): The TypeScript type of the value returned from `handle()`.
5. **Business Logic**: The actual operations to execute inside the controller (queries, saves, validations, etc.).
6. **Access Flags**: Whether `allowPrivateAccess` and/or `allowPublicAccess` should be enabled.

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to the following rules:

1. **No External Imports for Glyvio Globals**: All Glyvio namespaces (`glyvio_core`, `glyvio_entity`, `glyvio_structure`, `glyvio_permissions`) are injected globally at runtime. **Do NOT import them** from any package.

   - ✅ `glyvio_core.queryService.find<T>(sql)`
   - ❌ `import { queryService } from '@plugin/server'`

2. **No Try/Catch Blocks**: Do NOT wrap business logic in try/catch unless the user explicitly requests it. All business-rule violations must be thrown using `glyvio_core.GlyvioError`.

3. **Error Handling**: For all business rule failures (missing fields, not found, unauthorized, etc.), throw `glyvio_core.GlyvioError`:

   ```typescript
   throw new glyvio_core.GlyvioError({ message: 'descriptive message' });
   ```

   `console.log` and `console.error` are for diagnostic logging only; they do NOT communicate errors to callers.

4. **Type Safety (Zero `any`)**: Use `unknown` with type guards instead of `any`. All parameters, properties, and return values must be explicitly typed.

5. **File Naming Convention**: Controller files must use `snake_case` (e.g., `register_visit_controller.ts`). Classes must use `PascalCase` with the `Controller` suffix.

6. **Inheritance**: Always extend `glyvio_core.SimpleController<T, R>`, where `T` is the request body type and `R` is the response type.

7. **Decorator Registration**: Register the controller via `@glyvio_core.Controller({ path, allowPrivateAccess, allowPublicAccess })`. Do NOT register it manually in any registry.

8. **Validation First**: Always validate `request.body` before accessing its properties. A missing or malformed body must immediately throw `GlyvioError`.

9. **Entity Naming**: When setting `entityName` on entities, always use:
   ```typescript
   entity.entityName = glyvio_structure.AllEntities.sale.getEntityName();
   ```
   Never hardcode entity name strings directly.

---

## 📋 Execution Steps

### Step 1: Collect Missing Parameters

Before writing any code, verify all required parameters are supplied:

- `controllerId`, `className`, `requestBodyType`, `responseType`, `allowPrivateAccess`, `allowPublicAccess`
- Business logic description (what queries to run, what entities to save, what to return)

### Step 2: Create the Controller File

Create a new file at `src/controllers/<controller_id_snake_case>_controller.ts` in the plugin's server project.

Write the implementation following the blueprint below.

### Step 3: Register/Load the Controller

Ensure the controller file is imported in the server entrypoint (typically `src/index.ts` or `src/behavior_listeners/index.ts`) so the decorator fires at initialization:

```typescript
import './controllers/<controller_id_snake_case>_controller';
```

### Step 4: Build & Validate

Compile the codebase to confirm no type errors were introduced:

```bash
pnpm run build:fast
# or
pnpm tsc --noEmit
```

---

## 📄 Code Blueprints (Templates)

### Template A: Simple Query Controller (no request body)

```typescript
export interface <ResponseTypeName> {
  // Define response fields
}

@glyvio_core.Controller({
  path: '<controllerId>',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class <ClassName> extends glyvio_core.SimpleController<void, <ResponseTypeName>[]> {
  handle(_request: glyvio_core.WebRequest<void>): <ResponseTypeName>[] {
    return glyvio_core.queryService.find<<ResponseTypeName>>(
      `SELECT /* columns */ FROM /* table */ WHERE /* conditions */`,
    );
  }
}
```

### Template B: Request Body Controller with Entity Save

```typescript
export interface <RequestTypeName> {
  /**
   * Description of each field is mandatory so callers know what to provide.
   */
  fieldName: string;
}

export interface <ResponseTypeName> {
  id: string;
}

@glyvio_core.Controller({
  path: '<controllerId>',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class <ClassName> extends glyvio_core.SimpleController<<RequestTypeName>, <ResponseTypeName>> {
  handle(request: glyvio_core.WebRequest<<RequestTypeName>>): <ResponseTypeName> {
    const { body } = request;

    if (!body?.fieldName) {
      throw new glyvio_core.GlyvioError({ message: 'fieldName is required' });
    }

    const session = glyvio_core.sessionService.getCurrentSession();
    const id = glyvio_core.uuidService.v4();

    const entity = new glyvio_entity.<EntityClass>();
    entity.id = id;
    entity.fieldName = body.fieldName;
    entity.userGroupId = session.user.id;
    // entity.entityName = glyvio_structure.AllEntities.<entityKey>.getEntityName();

    glyvio_core.entityService.saveEntity(entity);

    return { id };
  }
}
```

### Template C: Batch Save Controller

```typescript
export interface <RequestTypeName> {
  items: Array<{
    /** Description of the item field */
    fieldName: string;
  }>;
}

@glyvio_core.Controller({
  path: '<controllerId>',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class <ClassName> extends glyvio_core.SimpleController<<RequestTypeName>, { imported: number }> {
  handle(request: glyvio_core.WebRequest<<RequestTypeName>>): { imported: number } {
    const { body } = request;

    if (!body?.items?.length) {
      throw new glyvio_core.GlyvioError({ message: 'items array is required and must not be empty' });
    }

    const queue: glyvio_core.EntityServiceQueue = [];

    for (const item of body.items) {
      const entity = new glyvio_entity.<EntityClass>();
      entity.id = glyvio_core.uuidService.v4();
      entity.fieldName = item.fieldName;
      entity.userGroupId = 'core_admin';
      queue.push(entity);
    }

    glyvio_core.entityService.saveList(queue);

    return { imported: queue.length };
  }
}
```

### Template D: HTML Report Controller

```typescript
export interface <DataRow> {
  // columns returned by the SQL query
}

@glyvio_core.Controller({
  path: '<controllerId>',
  allowPrivateAccess: true,
  allowPublicAccess: false,
})
export class <ClassName> extends glyvio_core.SimpleController<void, string> {
  handle(_request: glyvio_core.WebRequest<void>): string {
    const data = glyvio_core.queryService.find<<DataRow>>(
      `SELECT /* columns */ FROM /* table */ WHERE /* conditions */`,
    );

    return this.buildHtml(data);
  }

  private buildHtml(data: <DataRow>[]): string {
    // Build and return a complete HTML document string
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Report Title</title></head>
<body>
  <!-- Render data here -->
  <script>const rawData = ${JSON.stringify(data)};</script>
</body>
</html>`;
  }
}
```

---

## 🔧 Available Services

Use the following globally-available services inside controllers. Do NOT import them:

| Service                             | Access Path                                                         | Purpose                                  |
| ----------------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| SQL Query                           | `glyvio_core.queryService.find<T>(sql, params?)`                    | Execute raw SQL and return typed results |
| Save entity (with permission check) | `glyvio_core.entityService.saveEntity(entity)`                      | Persist a single entity instance         |
| Save batch (with permission check)  | `glyvio_core.entityService.saveList(queue)`                         | Persist multiple entities atomically     |
| Save without permission check       | `glyvio_core.entityService.saveEntityWithoutPermission(entity)`     | Internal saves bypassing ACL             |
| UUID generation                     | `glyvio_core.uuidService.v4()`                                      | Generate a new UUID                      |
| Current session                     | `glyvio_core.sessionService.getCurrentSession()`                    | Get logged-in user and company           |
| Permission check (admin)            | `glyvio_core.permissionService.isAdmin()`                           | Check if current user is administrator   |
| Permission check (specific)         | `glyvio_core.permissionService.hasPermissionInGroup(perm, groupId)` | Check a named permission                 |
| Business error                      | `new glyvio_core.GlyvioError({ message })`                          | Throw a structured business failure      |
| Interceptor execution               | `glyvio_core.interceptorService.executeInterceptors(event, body)`   | Trigger registered interceptors          |
| Strategy execution                  | `glyvio_core.strategyService.executeStrategy<T,R>(id, args)`        | Invoke a registered strategy             |

---

## ✅ Self-Correction Checklist

Before delivering the code, the agent must verify:

- [ ] Did I use `any` anywhere? → Refactor to `unknown` + type guards.
- [ ] Did I import from `@plugin/server`, `@plugin/commons`, or any external package for Glyvio globals? → Remove all such imports.
- [ ] Is the code and all documentation written in **English**? → Translate if needed.
- [ ] Does the file use `snake_case` naming? → Rename if needed.
- [ ] Does the class use `PascalCase` with a `Controller` suffix? → Rename if needed.
- [ ] Are all `request.body` accesses guarded with a null/undefined check? → Add guards.
- [ ] Are business errors thrown with `glyvio_core.GlyvioError`? → Replace any raw `throw new Error()`.
- [ ] Did I add any try/catch block that was NOT explicitly requested? → Remove it.
- [ ] Is the controller imported in `src/index.ts` or `src/behavior_listeners/index.ts`? → Add the import.
