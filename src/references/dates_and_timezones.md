# Datas e fuso horário da empresa

**Regra:** todo raciocínio de calendário — "hoje", início/fim do dia, semana, mês, ano, agrupar por
dia, "vence amanhã", exibir data/hora — usa o **fuso da empresa** (`company.zoneinfo`, IANA, ex.:
`America/Sao_Paulo`). Nunca o fuso da máquina (aparelho do usuário, servidor, máquina do
environment) e nunca UTC por acaso.

## Dois tipos de valor

| Tipo | Como é gravado | Como ler/exibir |
| --- | --- | --- |
| **Instante** (`createdAt`, `DateTime.now()`, horário agendado, data/hora de uma operação) | o instante real | no fuso da empresa: `format(p)`, `toCalendarDay()`, `startOfDay()`… |
| **Data civil / só data** (vencimento, competência, data de nascimento digitada) | 00:00 **UTC** do dia | em UTC: `format(p, false)`, `toCalendarDay(false)`, `fromCalendarDay(day, false)` |

Ler uma data civil no fuso da empresa (UTC−3) desloca para o **dia anterior** — um vencimento dia 1º
cai no mês anterior. Ler um instante em UTC faz o "dia" virar às 21h no Brasil.

Nos campos de formulário, `DateTextfieldDesign.hasZone` / `DateTimeTextfieldDesign.hasZone`
escolhem o tipo: `false` (padrão) = data civil, dígitos gravados como estão; `true` = instante,
convertido do/para o fuso local na exibição e na digitação. Use `hasZone: true` para campos que
recebem instantes reais (ex.: preenchidos com `DateTime.now()`).

## `glyvio_core.DateTime` — use os métodos de calendário

Métodos no **fuso da empresa** (use estes):

```ts
const now = glyvio_core.DateTime.now();
now.toCalendarDay();               // 'YYYY-MM-DD' de hoje na empresa
now.format('dd/MM/yyyy HH:mm');    // exibição no fuso da empresa
now.startOfDay(); now.endOfDay();
now.startOfWeek(); now.startOfMonth(); now.endOfMonth(); now.startOfYear(); now.endOfYear();
now.isSameDay(other); now.getIsoDayOfWeek(); /* 1 = segunda … 7 = domingo */ now.getDaysInMonth();
glyvio_core.DateTime.fromCalendarDay('2026-10-05');        // 00:00 desse dia na empresa
glyvio_core.DateTime.fromCalendarDay('2026-10-05', false); // 00:00 UTC (data civil)
```

**Evite** para raciocínio de calendário:

- `getHours()`, `getDay()` (dia do mês), `getDayOfWeek()`, `getMonth()` (0–11), `getYear()` — usam o
  fuso da **máquina**; perto da meia-noite discordam do calendário da empresa.
- `clearTime()` — devolve 00:00 **UTC**, não a meia-noite da empresa. Para "início do dia" use
  `startOfDay()`.
- `new Date()`, `Date.prototype.toLocale*String`, `new Date().toISOString().split('T')[0]` — fuso da
  máquina ou UTC. Para gravar um instante, `glyvio_core.DateTime.now()` basta.

## Fuso por camada

- **app** e **server**: o core já configura o `DateTime` com o fuso da empresa antes de rodar o
  código do plugin. Basta usar os métodos acima.
- **environment** (`@Action`, `@SystemTool`, `@CustomTool`, sync actions): o core **não** configura;
  sem isso, os métodos de calendário usam o fuso da máquina do environment. Configure no início da
  execução:

  ```ts
  glyvio_core.DateTime.setZoneinfo(glyvio_core.sessionService.getCurrentSession().company.zoneinfo ?? 'UTC');
  ```

Para ler o fuso (ex.: para passar ao SQL):

```ts
// app
const zone = glyvio_core.session.company.zoneinfo;
// server / environment
const zone = glyvio_core.sessionService.getCurrentSession().company.zoneinfo ?? 'UTC';
```

## SQL (relatórios, custom pages, dashboards, queries raw)

O banco não conhece o fuso da empresa: `now()`, `CURRENT_DATE`, `::date` e `date_trunc` sem fuso
trabalham em UTC (ou no fuso da sessão do banco). Passe o fuso como **parâmetro** e converta antes
de truncar/formatar:

```sql
WITH tz AS (SELECT ?::text AS zone)
SELECT to_char(s.created_at AT TIME ZONE tz.zone, 'YYYY-MM-DD') AS dia,      -- instante
       to_char(s.due_date   AT TIME ZONE 'UTC',   'YYYY-MM-DD') AS vencimento, -- data civil
       count(*)
FROM sale s, tz
WHERE s.created_at >= ? AND s.created_at < ?
GROUP BY 1, 2
```

```ts
const zone = glyvio_core.sessionService.getCurrentSession().company.zoneinfo ?? 'UTC';
const from = glyvio_core.DateTime.fromCalendarDay(fromDay)!;                 // 00:00 na empresa
const to = glyvio_core.DateTime.fromCalendarDay(toDay)!.plusDays(1);          // exclusivo
const rows = glyvio_core.queryService.find<Row>(SQL, [
  { dataType: 'TEXT', value: zone },
  { dataType: 'TIMESTAMP', value: from.toJSON() },
  { dataType: 'TIMESTAMP', value: to.toJSON() },
]);
```

- Agrupar por dia/mês de um **instante**: `date_trunc('day', col AT TIME ZONE ?)` / `to_char(col AT TIME ZONE ?, …)`.
- **Data civil**: `col AT TIME ZONE 'UTC'`.
- Filtros de período: calcule os limites em TS (`DateTime.fromCalendarDay(day)` / `startOfDay()` /
  `endOfDay()`) e passe como parâmetros; não use `CURRENT_DATE`/`now()::date` para "hoje".
- "Agora" para exibição: `now() AT TIME ZONE ?`.

Fontes externas (ERP via `dataSource`) podem gravar no fuso local delas; confirme com o usuário
antes de converter.

## Checklist

- [ ] "Hoje"/períodos calculados com `toCalendarDay()`/`startOfDay()`/`startOf*()`, não com `new Date()`, `clearTime()` ou `getDay()`/`getMonth()`.
- [ ] Datas civis lidas com `hasZone = false`; instantes no fuso da empresa.
- [ ] Código de environment chama `DateTime.setZoneinfo(...)` antes de usar métodos de calendário.
- [ ] SQL recebe o fuso como parâmetro e usa `AT TIME ZONE` antes de truncar/formatar.
