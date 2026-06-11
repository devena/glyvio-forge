# Database Queries using QueryBuilder

This example demonstrates how to construct, filter, join, order, and execute database queries using `glyvio_core.QueryBuilder` targeting the `AppUser` entity.

Following the Glyvio engine extension rules, this example uses global namespaces (`glyvio_core.*`, `glyvio_entity.*`, `glyvio_structure.*`) instead of importing from package paths.

## Table Aliases Note

By default, the table aliases used in the QueryBuilder (such as in filters, joins, or sort orders) default to the entity's structure name in **snake_case** (e.g., `app_user`). You can override this behavior by providing a custom `aliasTable` (or `aliasTableFrom`/`aliasTableForeign` in joins).

## Example Code

```typescript
export async function runQueryExamples(): Promise<void> {
  const appUserEntity = glyvio_structure.AllEntities.appUser;

  // ---------------------------------------------------------
  // 1. Basic Query Builder with Selected Fields
  // ---------------------------------------------------------
  // By default, fromEntity selects all fields. You can pass a specific
  // list of fields to retrieve using the options parameter.
  const nameField = appUserEntity.getFieldByEntityName('name')!;
  const emailField = appUserEntity.getFieldByEntityName('email')!;
  const idField = appUserEntity.getFieldByEntityName('id')!;

  const basicQb = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.AppUser>(appUserEntity, {
    fields: [idField, nameField, emailField],
    aliasTable: 'u', // Optional: overrides the default snake_case alias 'app_user'
  });

  // ---------------------------------------------------------
  // 2. Applying Filter Operations (AND Logic)
  // ---------------------------------------------------------
  // Adding multiple filters to the query builder joins them via 'AND'.

  // Filter by active status (Equals operator)
  const activeField = appUserEntity.getFieldByEntityName('isActive')!;
  basicQb.addFilterOperator(activeField, true);

  // Filter email using Case-Insensitive LIKE (ILIKE)
  basicQb.addFilterILike(emailField, 'admin');

  // Filter out records where integration_code is NULL
  const icField = appUserEntity.getFieldByStructureName('integration_code')!;
  basicQb.addFilterNull(icField, { operator: 'IS_NOT_NULL' });

  // ---------------------------------------------------------
  // 3. Complex Filtering (OR Logic)
  // ---------------------------------------------------------
  // Filters can be nested using object structures. To define 'OR' logic,
  // we add sub-filters to the 'ors' array of a filter node.

  // We want: (name ILIKE '%john%' OR email ILIKE '%john%')
  const searchNameFilter = new glyvio_core.QueryBuilderFilterILike({
    field: nameField,
    value: 'john',
    aliasTable: 'u',
  });

  const searchEmailFilter = new glyvio_core.QueryBuilderFilterILike({
    field: emailField,
    value: 'john',
    aliasTable: 'u',
  });

  // Nest email check as an OR condition under the name filter
  searchNameFilter.ors = [searchEmailFilter];

  // Add the combined filter to the query builder
  basicQb.addFilter(searchNameFilter);

  // ---------------------------------------------------------
  // 4. Ordering and Pagination
  // ---------------------------------------------------------
  // Order results by name descending
  basicQb.addOrderByEntity(nameField, 'DESC');

  // Add offset and limit for pagination
  basicQb.limit(10).offset(0);

  // Execute the query to find up to 10 matching records
  const users: glyvio_entity.AppUser[] = await basicQb.find();
  console.log(`Found ${users.length} users.`);

  // ---------------------------------------------------------
  // 5. Finding the First Match
  // ---------------------------------------------------------
  // findFirst() sets the limit to 1 internally and returns the record or undefined.
  const singleUserQb = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.AppUser>(appUserEntity).addFilterOperator(
    emailField,
    'system@glyvio.com',
  );

  const systemUser = await singleUserQb.findFirst();
  if (systemUser) {
    console.log(`Found system user: ${systemUser.name}`);
  }

  // ---------------------------------------------------------
  // 6. Automatic Paginated Retrieval of All Records
  // ---------------------------------------------------------
  // findAll() internally loops and paginates (500 records per batch)
  // to fetch all matching records from the database.
  const allActiveQb = glyvio_core.QueryBuilder.fromEntity<glyvio_entity.AppUser>(appUserEntity).addFilterOperator(
    activeField,
    true,
  );

  const allActiveUsers = await allActiveQb.findAll();
  console.log(`Total active users: ${allActiveUsers.length}`);

  // ---------------------------------------------------------
  // 7. Grouped and Aggregate Queries
  // ---------------------------------------------------------
  // You can execute GROUP BY queries with COUNT, SUM, etc. using findGrouped.
  interface UserCountByActiveState {
    isActiveVal: boolean;
    total: number;
  }

  const groupedResults = await glyvio_core.QueryBuilder.fromEntity<glyvio_entity.AppUser>(
    appUserEntity,
  ).findGrouped<UserCountByActiveState>([
    {
      field: activeField,
      type: 'BOOLEAN',
      aliasField: 'isActiveVal',
    },
    {
      field: idField,
      type: 'COUNT',
      aliasField: 'total',
    },
  ]);

  for (const group of groupedResults) {
    console.log(`Active state: ${group.isActiveVal}, count: ${group.total}`);
  }
}
```
