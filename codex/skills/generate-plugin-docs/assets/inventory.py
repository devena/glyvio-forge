#!/usr/bin/env python3
"""Inventory of a Glyvio plugin for its user documentation.

Usage: python3 inventory.py <plugin_root> <docs_src_dir>

Writes into <docs_src_dir>:
  schema.json      every entity of the manifest with its final fields (dbVersions merged in order,
                   deleted entities/fields removed)
  model.json       skeleton to fill: one entry per entity and field, with the manifest comment as
                   the starting description and empty texts for the rest (an existing model.json is
                   kept: only missing entities/fields are added)
  inventory.json   app routes (route classes loaded by routerService.loadRoutes), menu/admin items,
                   app interceptors, server controllers (path), interceptors (entity/event) and
                   strategies (id), each with its source file
  permissions.json the manifest permissions (view_* and option_*)
"""
import json
import re
import sys
from pathlib import Path


def merge_schema(manifest):
    ents, order = {}, []
    for version in manifest.get('dbVersions', []):
        for ent in version.get('entities', []):
            name = ent['friendlyName']
            if ent.get('deleted'):
                ents.pop(name, None)
                continue
            if name not in ents:
                ents[name] = {'name': name, 'comment': '', 'fields': {}}
                order.append(name)
            if ent.get('comment'):
                ents[name]['comment'] = ent['comment']
            for field in ent.get('fields', []):
                fname = field['friendlyName']
                if field.get('deleted'):
                    ents[name]['fields'].pop(fname, None)
                    continue
                merged = ents[name]['fields'].get(fname, {})
                merged.update(field)
                ents[name]['fields'][fname] = merged
    out = []
    for name in order:
        if name in ents:
            ent = ents[name]
            ent['fields'] = list(ent['fields'].values())
            out.append(ent)
    return out


def skeleton(schema, existing):
    model = dict(existing)
    for ent in schema:
        entry = model.setdefault(ent['name'], {
            'label': '', 'group': '', 'purpose': ent.get('comment', ''), 'why': '', 'care': '', 'fields': {}})
        fields = entry.setdefault('fields', {})
        for field in ent['fields']:
            fields.setdefault(field['friendlyName'], [field.get('comment', ''), ''])
    return model


def grep_files(root, pattern, glob='*.ts'):
    rx = re.compile(pattern)
    for path in sorted(root.rglob(glob)):
        if 'node_modules' in path.parts or '@types' in path.parts or 'dist' in path.parts:
            continue
        text = path.read_text(encoding='utf-8', errors='ignore')
        for match in rx.finditer(text):
            yield path, match, text


def inventory(plugin):
    app = plugin / 'plugin' / 'app' / 'src'
    server = plugin / 'plugin' / 'server' / 'src'
    inv = {'routes': [], 'menu': [], 'appInterceptors': [], 'controllers': [], 'interceptors': [], 'strategies': []}
    if app.exists():
        for path, m, text in grep_files(app, r'export class (\w+Route) extends glyvio_core\.(\w+)'):
            body = text[m.end():m.end() + 900]
            rp = re.search(r"getRoutePath\(\)[^{]*\{\s*return '([^']+)'", body)
            inv['routes'].append({'route': m.group(1), 'screen': m.group(1)[:-5], 'base': m.group(2),
                                  'path': rp.group(1) if rp else None, 'file': str(path.relative_to(plugin))})
        for path, m, text in grep_files(app, r"key: '([^']+)',\s*\n\s*(?:name|title): '([^']+)'"):
            if 'menuRegistryService' in text or 'adminRegistryService' in text:
                inv['menu'].append({'key': m.group(1), 'title': m.group(2), 'file': str(path.relative_to(plugin))})
        for path, m, text in grep_files(app, r'export class (\w+) extends ([\w.]+Interceptor)\b'):
            inv['appInterceptors'].append({'class': m.group(1), 'extends': m.group(2), 'file': str(path.relative_to(plugin))})
    if server.exists():
        for path, m, text in grep_files(server, r"@glyvio_core\.Controller\(\{\s*path:\s*'([^']+)'"):
            inv['controllers'].append({'path': m.group(1), 'file': str(path.relative_to(plugin))})
        for path, m, text in grep_files(server, r'@glyvio_core\.(BeforeInterceptor|AfterInterceptor|AfterCommitInterceptor|SyncInterceptor|Interceptor)\(\{([^)]*)\}'):
            args = m.group(2)
            ent = re.search(r'entity:\s*glyvio_entity\.(\w+)', args)
            ev = re.search(r'eventName:\s*([\w.\'"]+)', args)
            inv['interceptors'].append({'kind': m.group(1), 'entity': ent.group(1) if ent else None,
                                        'event': ev.group(1) if ev else None, 'file': str(path.relative_to(plugin))})
        for path, m, text in grep_files(server, r'@glyvio_core\.Strategy\(\{\s*id:\s*([\w\'".]+)'):
            inv['strategies'].append({'id': m.group(1), 'file': str(path.relative_to(plugin))})
    return inv


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    plugin, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((plugin / 'manifest.json').read_text(encoding='utf-8'))
    schema = merge_schema(manifest)
    (out / 'schema.json').write_text(json.dumps(schema, ensure_ascii=False, indent=1), encoding='utf-8')
    model_path = out / 'model.json'
    existing = json.loads(model_path.read_text(encoding='utf-8')) if model_path.exists() else {}
    model_path.write_text(json.dumps(skeleton(schema, existing), ensure_ascii=False, indent=1), encoding='utf-8')
    (out / 'inventory.json').write_text(json.dumps(inventory(plugin), ensure_ascii=False, indent=1), encoding='utf-8')
    (out / 'permissions.json').write_text(json.dumps(manifest.get('permissions', []), ensure_ascii=False, indent=1), encoding='utf-8')
    inv = json.loads((out / 'inventory.json').read_text(encoding='utf-8'))
    print(json.dumps({'entities': len(schema), 'fields': sum(len(e['fields']) for e in schema),
                      **{k: len(v) for k, v in inv.items()}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
