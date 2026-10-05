# Simple Map Page Example

A map page (`glyvio_core.SimpleMapPage`) that plots `Address` records (which have `latitude`/`longitude`
`Decimal` columns) as pins, loading only the records inside the visible area. Generated from the
`create-map-page` skill and compiled against `@types/glyvio_core.d.ts`; the interceptor counterpart
is in the `create-map-page-interceptor` skill.

Key points:

- `populateAreaFilter` restricts both coordinates with `addFilterBetween` (its parameters are the
  **global** `Decimal` type).
- The query uses the real `QueryBuilder` API (`setFromEntity`, `addFilterOperator`, `addFilterILike`,
  `addFilterBetween`, `addFilter(new glyvio_core.QueryBuilderFilter({ ors }))`). There is no
  `addSelect`, `filter()`, `.equals()` or `.like()`.
- No `any`: entity getters are typed (`item.latitude?.toNumber()`).

```typescript
export interface AddressMapFilter extends glyvio_core.SimpleMapPageStateFilter {
  city?: string;
}

export interface AddressMapRouteParams extends glyvio_core.SimpleMapPageRouteParams<AddressMapFilter> {}

export interface AddressMapPageState extends glyvio_core.SimpleMapPageState<AddressMapRouteParams, AddressMapFilter> {}

export class AddressMapPageRoute extends glyvio_core.SimpleMapPageRoute<AddressMapRouteParams> {
  getRoutePermission(): glyvio_permissions.Permission | undefined {
    return undefined;
  }
  getRoutePath(): string {
    return '/address-map';
  }
  getRouteNameSpace(): string {
    return 'my_plugin';
  }
  getRouteNameObject(): string {
    return 'AddressMapPage';
  }
}

export class AddressMapPage extends glyvio_core.SimpleMapPage<AddressMapPageState, glyvio_entity.Address> {
  constructor() {
    super(AddressMapPageRoute);
  }

  async initState(state: AddressMapPageState): Promise<void> {
    await super.initState(state);
    state.userConfigKey = 'MY_PLUGIN_ADDRESS_MAP_PAGE';
    await this.loadUserConfig(state);
  }

  async events(_state: AddressMapPageState, _action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined;
  }

  getDesign(state: AddressMapPageState, design: glyvio_core.SimpleMapPageDesign): void {
    const appBar = design.appBarDesign as glyvio_core.SimpleAppBarDesign | undefined;
    if (appBar) {
      appBar.title = '$T{my_plugin_addressMap_title}';
    }
    design.filterSectionsDesign?.push(
      glyvio_core.FilterSidebar.section('addressMap.filters', '$T{my_plugin_addressMap_filters}', [
        new glyvio_core.StringTextfieldDesign({
          name: 'state.filtersSidebar.city',
          label: '$T{my_plugin_addressMap_city}',
        }),
      ]),
    );
  }

  getDesignForCell(_state: AddressMapPageState, item: glyvio_entity.Address): glyvio_core.SimpleMapCellDesign {
    return new glyvio_core.SimpleMapCellDesign({
      latitude: item.latitude?.toNumber() ?? null,
      longitude: item.longitude?.toNumber() ?? null,
      title: item.name ?? '',
      description: item.formattedAddress ?? '',
      colorTheme: 'BLUE',
    });
  }

  populateQueryBuilder(state: AddressMapPageState, queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.Address>): void {
    const e = glyvio_structure.AllEntities.address;
    queryBuilder.setFromEntity(e);
    queryBuilder.addFilterOperator(e.deleted, false);
    if (state.filtersSidebar?.city) {
      queryBuilder.addFilterILike(e.city, state.filtersSidebar.city);
    }
  }

  populateMainFilter(_state: AddressMapPageState, text: string): glyvio_core.QueryBuilderFilter {
    const e = glyvio_structure.AllEntities.address;
    return new glyvio_core.QueryBuilderFilter({
      ors: [
        new glyvio_core.QueryBuilderFilterILike({ field: e.name, value: text }),
        new glyvio_core.QueryBuilderFilterILike({ field: e.formattedAddress, value: text }),
      ],
    });
  }

  populateAreaFilter(
    _state: AddressMapPageState,
    queryBuilder: glyvio_core.QueryBuilder<glyvio_entity.Address>,
    southWestLatitude: Decimal,
    southWestLongitude: Decimal,
    northEastLatitude: Decimal,
    northEastLongitude: Decimal,
  ): void {
    const e = glyvio_structure.AllEntities.address;
    queryBuilder.addFilterBetween(e.latitude, southWestLatitude, northEastLatitude);
    queryBuilder.addFilterBetween(e.longitude, southWestLongitude, northEastLongitude);
  }

  async onCellTap(_state: AddressMapPageState, item: glyvio_entity.Address): Promise<void> {
    // e.g. await this.pushSidebar(new AddressSidebarRoute({ id: item.id! }));
  }

  getEntityToTracking(item: glyvio_entity.Address): { structureName: string; objectId: string } | undefined {
    return {
      structureName: glyvio_structure.AllEntities.address.getStructureName(),
      objectId: item.id!,
    };
  }
}
```
