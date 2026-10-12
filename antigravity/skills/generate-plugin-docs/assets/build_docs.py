#!/usr/bin/env python3
"""Builds the user documentation HTML of a Glyvio plugin (Glyvio brandbook) from its content files.

Usage: python3 build_docs.py <docs_src_dir> <out_dir>

<docs_src_dir> (see the generate-plugin-docs skill for the format of each file):
  meta.json        title, plugin, version, groups order, overview index, glossary, footer
  overview.html    HTML fragment of the overview (concepts, menus, statuses, flows)
  schema.json      written by inventory.py
  model.json       entity and field texts
  screens.json     screens: group, img, name, where, kind, desc, purpose, flow[], care[], perm
  routines.json    routines: group, kind, name, where, trigger, purpose, input, output, why, care
  permissions.json written by inventory.py (option_* are listed; labels come from the manifest)
  prints/          screenshots named <img>.jpg (copied to <out_dir>/prints)

Writes <out_dir>/index.html and <out_dir>/prints/. Fails on a field or entity of schema.json without
text, so the documentation never ships with gaps.
"""
import html
import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path

e = html.escape
TYPE = {'TEXT': 'Texto', 'DECIMAL': 'Decimal', 'BOOLEAN': 'Sim/Não', 'TIMESTAMP': 'Data', 'JSON': 'JSON', 'INTEGER': 'Inteiro'}
EXT = {'currency': 'Moeda', 'app_user': 'Usuário', 'client': 'Cliente', 'supplier': 'Fornecedor', 'sale': 'Venda',
       'purchase': 'Compra', 'payment_method': 'Forma de pagamento', 'sale_invoice': 'Nota de venda',
       'purchase_invoice': 'Nota de compra', 'user_group': 'Grupo de usuários', 'attachment': 'Anexo', 'person': 'Pessoa',
       'product': 'Produto'}


def slug(x):
    x = unicodedata.normalize('NFD', x).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', x.lower()).strip('-')


def load(src, name, default=None):
    p = src / name
    if not p.exists():
        if default is None:
            raise SystemExit(f'missing {p}')
        return default
    return json.loads(p.read_text(encoding='utf-8'))


def ordered_groups(items, preferred):
    seen = [g for g in preferred if any(i == g for i in items)]
    for g in items:
        if g not in seen:
            seen.append(g)
    return seen


def build(src, out):
    meta = load(src, 'meta.json')
    schema = load(src, 'schema.json')
    model = load(src, 'model.json')
    screens = load(src, 'screens.json', [])
    routines = load(src, 'routines.json', [])
    perms = load(src, 'permissions.json', [])
    overview = (src / 'overview.html').read_text(encoding='utf-8') if (src / 'overview.html').exists() else ''
    labels = {k: v.get('label') or k for k, v in model.items()}

    # ---- checks: every entity/field documented
    gaps = []
    for ent in schema:
        m = model.get(ent['name'])
        if not m:
            gaps.append(ent['name'])
            continue
        for k in ('label', 'group', 'purpose', 'why'):
            if not m.get(k):
                gaps.append(f"{ent['name']}.{k}")
        for f in ent['fields']:
            t = m.get('fields', {}).get(f['friendlyName'])
            if not t or not t[0] or not t[1]:
                gaps.append(f"{ent['name']}.{f['friendlyName']}")
    if gaps:
        raise SystemExit('model.json incomplete (' + str(len(gaps)) + '): ' + ', '.join(gaps[:30]))

    out.mkdir(parents=True, exist_ok=True)
    prints_out = out / 'prints'
    prints_out.mkdir(exist_ok=True)
    if (src / 'prints').exists() and (src / 'prints').resolve() != prints_out.resolve():
        for p in (src / 'prints').iterdir():
            if p.suffix.lower() in ('.jpg', '.png') and not p.name.startswith('_'):
                shutil.copy2(p, prints_out / p.name)

    def ftype(f):
        c = f.get('config') or {}
        fk = c.get('foreignKey')
        if fk:
            t = fk.get('entity') if isinstance(fk, dict) else fk
            return 'Referência', labels.get(t, EXT.get(t, t))
        if c.get('sequence'):
            return 'Sequência', ''
        return TYPE.get(f.get('dataType'), f.get('dataType') or ''), ''

    groups = meta.get('groups', {})
    # ---- data model
    model_html, model_nav = [], []
    for g in ordered_groups([model[x['name']]['group'] for x in schema], groups.get('model', [])):
        model_html.append(f'<h3 class="grp" id="m-{slug(g)}">{e(g)}</h3>')
        model_nav.append((f'm-{slug(g)}', g))
        for ent in [x for x in schema if model[x['name']]['group'] == g]:
            m = model[ent['name']]
            rows = []
            for f in ent['fields']:
                desc, why = m['fields'][f['friendlyName']][:2]
                t, ref = ftype(f)
                c = f.get('config') or {}
                chips = []
                if c.get('notNull'):
                    chips.append('<span class="chip req">obrigatório</span>')
                if 'defaultValue' in c:
                    dv = str(c['defaultValue']).strip("'")
                    dv = {'True': 'sim', 'true': 'sim', 'False': 'não', 'false': 'não'}.get(dv, dv)
                    chips.append(f'<span class="chip">padrão: {e(dv)}</span>')
                tcell = e(t) + (f'<br><span class="ref">→ {e(ref)}</span>' if ref else '')
                chip_html = '<div class="chips">' + ''.join(chips) + '</div>' if chips else ''
                rows.append(f'<tr><td><code>{e(f["friendlyName"])}</code>{chip_html}</td><td class="ty">{tcell}</td>'
                            f'<td>{e(desc)}</td><td class="why">{e(why)}</td></tr>')
            care = f'<div class="warn"><h5>Cuidados</h5><p>{e(m["care"])}</p></div>' if m.get('care') else '<div></div>'
            model_html.append(f'''<article class="card ent searchable" id="e-{ent["name"]}">
<header><div><p class="eyebrow">Entidade · <code>{e(ent["name"])}</code></p><h4>{e(m["label"])}</h4></div><span class="count">{len(ent["fields"])} campos</span></header>
<div class="ent-meta"><div><h5>Para que serve</h5><p>{e(m["purpose"])}</p></div><div><h5>Por que existe</h5><p>{e(m["why"])}</p></div>{care}</div>
<div class="tbl"><table><thead><tr><th>Campo</th><th>Tipo</th><th>Descrição</th><th>Justificativa</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>
</article>''')

    # ---- screens
    screens_html, screens_nav, missing = [], [], []
    for g in ordered_groups([x['group'] for x in screens], groups.get('screens', [])):
        screens_html.append(f'<h3 class="grp" id="t-{slug(g)}">{e(g)}</h3>')
        screens_nav.append((f't-{slug(g)}', g))
        for x in [y for y in screens if y['group'] == g]:
            img = next((x['img'] + ext for ext in ('.jpg', '.png') if (prints_out / (x['img'] + ext)).exists()), None)
            if img:
                fig = (f'<figure><a href="prints/{img}" target="_blank" rel="noopener"><img loading="lazy" src="prints/{img}" '
                       f'alt="Print da tela {e(x["name"])}"></a></figure>')
            else:
                missing.append(x['img'])
                fig = '<figure class="noimg"><p>Print não disponível nesta versão</p></figure>'
            flow = ''.join(f'<li>{e(i)}</li>' for i in x.get('flow', []))
            care = ''.join(f'<li>{e(i)}</li>' for i in x.get('care', []) if i and i != '—') or '<li>Sem cuidados especiais.</li>'
            perm = f'<p class="perm">Permissão: <code>{e(x["perm"])}</code></p>' if x.get('perm') else ''
            screens_html.append(f'''<article class="card scr searchable" id="s-{x["img"]}">
<header><div><p class="eyebrow">{e(x.get("kind", ""))}</p><h4>{e(x["name"])}</h4></div></header>
<p class="loc"><span>Localização</span>{e(x["where"])}</p>
{fig}<div class="scr-body"><div class="scr-text"><h5>Descrição</h5><p>{e(x["desc"])}</p><h5>Propósito</h5><p>{e(x["purpose"])}</p>{perm}</div>
<div class="scr-text"><h5>Fluxo de operação</h5><ol>{flow}</ol><div class="warn"><h5>Cuidados</h5><ul>{care}</ul></div></div></div></article>''')

    # ---- routines
    rout_html, rout_nav = [], []
    for g in ordered_groups([x['group'] for x in routines], groups.get('routines', [])):
        rout_html.append(f'<h3 class="grp" id="r-{slug(g)}">{e(g)}</h3>')
        rout_nav.append((f'r-{slug(g)}', g))
        for x in [y for y in routines if y['group'] == g]:
            rout_html.append(f'''<article class="card rot searchable">
<header><div><p class="eyebrow"><span class="kind k-{slug(x["kind"])}">{e(x["kind"])}</span></p><h4>{e(x["name"])}</h4></div></header>
<p class="loc"><span>Localização</span><code>{e(x["where"])}</code></p>
<dl><dt>Quando roda</dt><dd>{e(x["trigger"])}</dd><dt>Propósito</dt><dd>{e(x["purpose"])}</dd>
<dt>Entrada</dt><dd>{e(x["input"])}</dd><dt>Saída</dt><dd>{e(x["output"])}</dd>
<dt>Justificativa</dt><dd>{e(x["why"])}</dd><dt class="w">Cuidados</dt><dd class="w">{e(x.get("care") or "—")}</dd></dl></article>''')

    # ---- permissions (option_* from the manifest)
    opts = [p for p in perms if str(p.get('key', '')).startswith('option_')]
    perm_rows = ''.join(f'<tr><td><code>{e(p["key"])}</code></td><td>{e(p.get("label", ""))}</td></tr>' for p in opts)
    perm_html = (f'<div class="tbl"><table><thead><tr><th>Permissão</th><th>Libera</th></tr></thead><tbody>{perm_rows}</tbody></table></div>'
                 if opts else '<p class="lead">O plugin não declara permissões de ação.</p>')

    gloss = ''.join(f'<tr><td><b>{e(t)}</b></td><td>{e(d)}</td></tr>' for t, d in meta.get('glossary', []))
    gloss_html = f'<h2 id="glossario">Glossário</h2><div class="tbl"><table style="min-width:560px"><tbody>{gloss}</tbody></table></div>' if gloss else ''

    nav = lambda items: ''.join(f'<li><a href="#{i}">{e(t)}</a></li>' for i, t in items)
    stats = {'ENT': len(schema), 'FIELDS': sum(len(x['fields']) for x in schema), 'SCREENS': len(screens), 'ROUT': len(routines)}
    tpl = (Path(__file__).parent / 'template.html').read_text(encoding='utf-8')
    rep = {
        'TITLE': meta['title'], 'PLUGIN': meta.get('plugin', ''), 'VERSION': meta.get('version', ''),
        'HERO_TITLE': meta.get('heroTitle', meta['title']), 'HERO_TEXT': meta.get('heroText', ''),
        'FOOTER': meta.get('footer', ''),
    }
    html_out = tpl
    for k, v in rep.items():
        html_out = html_out.replace('{{' + k + '}}', e(v))
    html_out = (html_out.replace('{{OVERVIEW}}', overview)
                .replace('{{NAV_OVERVIEW}}', nav(meta.get('overviewNav', [])))
                .replace('{{MODEL}}', '\n'.join(model_html)).replace('{{SCREENS}}', '\n'.join(screens_html))
                .replace('{{ROUTINES}}', '\n'.join(rout_html)).replace('{{PERMISSIONS}}', perm_html)
                .replace('{{GLOSSARY}}', gloss_html).replace('{{NAV_GLOSSARY}}', '<h6><a href="#glossario">Glossário</a></h6>' if gloss else '')
                .replace('{{NAV_MODEL}}', nav(model_nav)).replace('{{NAV_SCREENS}}', nav(screens_nav)).replace('{{NAV_ROUT}}', nav(rout_nav)))
    for k, v in stats.items():
        html_out = html_out.replace('{{N_' + k + '}}', str(v))
    (out / 'index.html').write_text(html_out, encoding='utf-8')
    print(json.dumps({**{k.lower(): v for k, v in stats.items()}, 'screens_without_print': missing}, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    build(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
