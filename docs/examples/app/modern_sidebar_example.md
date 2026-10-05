<!-- Generated from src/examples/app/modern_sidebar_example.md by tools/generate.py. Edit the source, not this file. -->
# Example: Sidebar in the modern visual pattern (`glyvio_core.ui`)

Condensed from the core's `AppUserSidebar` (redesign of 28/09/2026). It shows the recurring
pieces of the modern pattern: tinted header, highlight card, a responsive row of summary cards,
a structured list inside a card, ghost actions, ICU text, and **keeping the `main.layout` key**
that other plugins' interceptors push fields into.

```typescript
const ui = glyvio_core.ui;

export class MemberSidebar extends glyvio_core.SimpleSidebar<MemberSidebarState> {
  async events(_state: MemberSidebarState, _action: glyvio_core.Action): Promise<glyvio_core.EventReturn> {
    return undefined; // handle your own action keys here
  }

  getDesign(state: MemberSidebarState, design: glyvio_core.SimpleSidebarDesign): void {
    const member = state.member;
    const groups = state.groups ?? [];
    const canEdit = glyvio_core.permissionService.isAdmin();

    design.appBarDesign = new glyvio_core.SimpleAppBarDesign({
      key: 'appBar',
      leading: new glyvio_core.SimpleIconDesign({
        key: 'title.icon',
        name: 'sax_linear_profile_2user',
        size: 20,
        colorTheme: 'BLUE',
        variant: 'subtle',
        showBackground: true,
      }),
      title: '$S{state.member.name}',
      subtitle: '$T{my_memberSidebar_entityLabel} #$S{state.member.code}',
      buttons: [
        new glyvio_core.ActionButtonDesign({
          key: 'edit.button',
          type: 'SECONDARY',
          iconName: 'sax_linear_edit',
          visible: canEdit,
          action: new glyvio_core.Action({ key: 'edit', data: { id: member?.id } }),
        }),
      ],
    });

    // 1. Highlight card: avatar + name + status badges (computed in TS, no nested Handlebars).
    const hero = new glyvio_core.SurfaceDesign({
      key: 'profile.card',
      surface: 'GREEN',
      padding: 'lg',
      radius: 'xl',
      child: ui.row(
        [
          new glyvio_core.AvatarDesign({ text: member?.name ?? '', size: 28, colorTheme: 'GREEN' }),
          ui.grow(
            ui.column(
              [
                ui.text('$S{state.member.name}', 'TITLE_LARGE', { maxLines: 1 }),
                ui.muted('$S{state.member.email}', 'BODY_MEDIUM', 1),
                ui.row(
                  [
                    member?.deleted
                      ? ui.badge('$T{my_memberSidebar_deleted}', 'DANGER', { dot: true })
                      : ui.badge('$T{my_memberSidebar_active}', 'SUCCESS', { dot: true }),
                    // ICU: "{count, plural, =0{Sem grupos} one{1 grupo} other{# grupos}}"
                    ui.badge(glyvio_core.t('my_memberSidebar_groupsCount', { count: groups.length }), 'PURPLE'),
                  ],
                  { gap: 'xs', wrap: true },
                ),
              ],
              { gap: 'xxs', align: 'START' },
            ),
          ),
        ],
        { gap: 'md' },
      ),
    });

    // 2. Details card keeps the legacy FormLayoutDesign with key 'main.layout':
    //    other plugins do findWidgetByKey('main.layout').children.push(...). Never rename it.
    const details = ui.card({
      key: 'details.card',
      children: [
        ui.muted('$T{my_memberSidebar_details}', 'OVERLINE', 1),
        new glyvio_core.FormLayoutDesign({
          key: 'main.layout',
          columnSize: 200,
          children: [
            new glyvio_core.FormLayoutFieldDesign({
              columns: 2,
              key: 'phone.formField',
              child: new glyvio_core.StringTextLabelDesign({ label: '$T{my_memberSidebar_phone}', value: '$S{state.member.phone}' }),
            }),
          ],
        }),
      ],
    });

    // 3. Structured list inside a card: header row + rows with the same flex, trash only for editors.
    const rows = groups.map((g) =>
      ui.row(
        [
          ui.grow(ui.row([ui.iconTile('sax_linear_people', 'PURPLE', 16), ui.grow(ui.text(g.name ?? '', 'LABEL_LARGE', { maxLines: 1 }))]), 3),
          ui.grow(ui.badge(g.role ?? '-', 'INFO', { icon: 'sax_linear_shield_tick' }), 3),
          new glyvio_core.ActionButtonDesign({
            key: 'removeGroup.button',
            type: 'SECONDARY',
            variant: 'ghost',
            iconName: 'sax_linear_trash',
            visible: canEdit,
            action: new glyvio_core.Action({ key: 'removeGroup', data: { id: g.id } }),
          }),
        ],
        { gap: 'md', padding: 'xs 0' },
      ),
    );
    const groupsCard = ui.card({
      key: 'groups.card',
      title: '$T{my_memberSidebar_groups}',
      subtitle: '$T{my_memberSidebar_groupsHint}',
      icon: 'sax_linear_shield_tick',
      color: 'INDIGO',
      actions: canEdit
        ? [ui.button('$T{my_memberSidebar_addGroup}', new glyvio_core.Action({ key: 'addGroup', data: {} }), { icon: 'sax_linear_add' })]
        : [],
      children:
        rows.length == 0
          ? [ui.muted('$T{my_memberSidebar_noGroups}', 'BODY_MEDIUM')]
          : [
              ui.row(
                [
                  ui.grow(ui.muted('$T{my_memberSidebar_colGroup}', 'OVERLINE', 1), 3),
                  ui.grow(ui.muted('$T{my_memberSidebar_colRole}', 'OVERLINE', 1), 3),
                  ...(canEdit ? [new glyvio_core.SizedBoxDesign({ width: 40, height: 1 })] : []),
                ],
                { gap: 'md' },
              ),
              ui.list(rows),
            ],
    });

    // 4. One section (ui.page) holding everything; the grid stacks on narrow widths.
    design.sectionsDesign = [
      ui.page(
        [
          hero,
          ui.grid(
            [
              [details, [6, 12, 12]],
              [ui.stat({ label: '$T{my_memberSidebar_lastAccess}', value: '$D{state.member.lastAccess formatter="DATE"}', icon: 'sax_linear_clock', color: 'BLUE' }), [6, 12, 12]],
            ],
            { equalHeight: true },
          ),
          groupsCard,
        ],
        { key: 'main.section', width: 1000, gap: 'md' },
      ),
    ];
  }
}
```

Checklist for this pattern:

- Paddings on `SurfaceDesign`/stacks are CSS order (`'xs 0'` = vertical 8, horizontal 0).
- Every grid item has `[lg, md, sm]` spans; `equalHeight` for side-by-side cards.
- Empty states are a muted sentence plus the action that fixes it.
- All `$T{}` keys exist in every `.arb`; counts use ICU (`glyvio_core.t(key, { count })`).
- Before shipping a redesign of an existing view, grep other plugins for `findWidgetByKey` on it.
