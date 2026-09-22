#!/usr/bin/env python3
"""Render assistant packages from src using Python 3.11+ (standard library only)."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = '.generated-files.json'
TOKEN = re.compile(r'@@([A-Z_]+|AGENT:[a-z0-9-]+)@@')
NOTICE = '<!-- Generated from {source} by tools/generate.py. Edit the source, not this file. -->\n'


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_path(root: Path, relative: str) -> Path:
    path = PurePosixPath(relative)
    if path.is_absolute() or '..' in path.parts or not path.parts:
        raise ValueError(f'Invalid relative path: {relative}')
    result = root / relative
    if result.is_symlink() or not result.resolve().is_relative_to(root.resolve()):
        raise ValueError(f'Refusing symlink or path outside project: {relative}')
    return result


def split_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Canonical headers use single-line JSON strings (a valid YAML subset)."""
    match = re.fullmatch(r'---\n(.*?)\n---\n(.*)', text, re.S)
    if not match:
        raise ValueError('Expected YAML frontmatter')
    metadata = {}
    for line in match[1].splitlines():
        key, separator, value = line.partition(': ')
        if not separator or key in metadata:
            raise ValueError(f'Invalid or duplicate header: {line}')
        metadata[key] = json.loads(value) if value.startswith('"') else value
    if set(metadata) != {'name', 'description'}:
        raise ValueError('Canonical headers must contain only name and description')
    if not all(isinstance(value, str) for value in metadata.values()):
        raise ValueError('Name and description must be strings')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', metadata['name']):
        raise ValueError(f'Invalid name: {metadata["name"]}')
    if len(metadata['name']) > 64:
        raise ValueError('Name must contain at most 64 characters')
    if not metadata['description'] or len(metadata['description']) > 1024:
        raise ValueError('Description must contain 1–1024 characters')
    return metadata, match[2]


def markdown_header(metadata: dict[str, str], body: str) -> str:
    return '---\n' + ''.join(f'{key}: {json.dumps(value, ensure_ascii=False)}\n'
                             for key, value in metadata.items()) + '---\n' + body


def render(text: str, config: dict) -> str:
    base = config['runtime_root']
    values = {
        'ASSISTANT': config['assistant'],
        'REFERENCES': f'{base}/{config["references"]}',
        'CATALOG': f'{base}/{config["catalog"]}' if config['catalog'] else '',
        'SKILLS': f'{base}/skills', 'SCRIPTS': f'{base}/scripts',
        'TEMP': f'{base}/temp', 'PROJECT_INSTRUCTIONS': config['instructions'],
        'ARCHITECTURE': (f'{base}/rules/architecture_rules.md' if config['format'] in {'antigravity', 'agy'}
                         else f'{base}/{config["references"]}/architecture_rules.md'),
    }
    def replace(match: re.Match) -> str:
        key = match[1]
        if key.startswith('AGENT:'):
            name = key.partition(':')[2]
            for filename, role in config['agents'].items():
                if role == name:
                    return f'{base}/agents/{filename}'
            if config['format'] == 'agy':
                return f'{name} (available in the full assistant packages)'
            raise ValueError(f'Agent is not configured: {name}')
        if key not in values or not values[key]:
            raise ValueError(f'Unsupported token for {config["assistant"]}: {key}')
        return values[key]
    result = TOKEN.sub(replace, text)
    if '@@' in result:
        raise ValueError('Unresolved source token')
    return result


def build(root: Path) -> dict[str, bytes]:
    """Pure render: no output directories or files are changed."""
    src = root / 'src'
    outputs: dict[str, bytes] = {}

    def emit(destination: str, content: str | bytes, source: Path) -> None:
        safe_path(root, destination)
        if destination in outputs:
            raise ValueError(f'Duplicate output: {destination}')
        if isinstance(content, bytes):
            outputs[destination] = content
            return
        origin = source.relative_to(root).as_posix()
        if destination.endswith('.md'):
            notice = NOTICE.format(source=origin)
            if content.startswith('---\n'):
                end = content.index('\n---\n', 4) + len('\n---\n')
                content = content[:end] + notice + content[end:]
            else:
                content = notice + content
        elif destination.endswith('.toml'):
            content = f'# Generated from {origin} by tools/generate.py.\n' + content
            tomllib.loads(content)
        elif destination.endswith('.js'):
            notice = f'// Generated from {origin} by tools/generate.py.\n'
            if content.startswith('#!'):
                first, rest = content.split('\n', 1)
                content = first + '\n' + notice + rest
            else:
                content = notice + content
        outputs[destination] = content.encode('utf-8')

    skills = {p.parent.name: p for p in sorted((src / 'skills').glob('*/SKILL.md'))}
    if not skills:
        raise ValueError('No canonical skills found in src/skills')
    for name, path in skills.items():
        metadata, _ = split_frontmatter(path.read_text())
        if metadata['name'] != name:
            raise ValueError(f'Skill name differs from folder: {path}')
    agent_sources = {p.stem: p for p in sorted((src / 'agents').glob('*.md'))}
    for adapter in sorted((src / 'adapters').iterdir()):
        if not adapter.is_dir():
            continue
        target = adapter.name
        if target not in {'claude', 'antigravity', 'codex', 'agy'}:
            raise ValueError(f'Unknown output package: {target}')
        config = json.loads((adapter / 'config.json').read_text())
        if config['agents'] and set(config['agents'].values()) != set(agent_sources):
            raise ValueError(f'{target} must map every canonical agent exactly once')
        if len(config['agents']) != len(set(config['agents'].values())):
            raise ValueError(f'{target} contains duplicate agent mappings')
        selected = sorted(skills) if config['skills'] == '*' else config['skills']
        for name in selected:
            if name not in skills:
                raise ValueError(f'Unknown skill in {target}: {name}')
            directory = skills[name].parent
            for path in sorted(directory.rglob('*')):
                if path.is_file():
                    # Only instruction Markdown is templated; assets and executable helpers
                    # must retain their original bytes (including binary files).
                    content = render(path.read_text(), config) if path.suffix == '.md' else path.read_bytes()
                    emit(f'{target}/skills/{name}/{path.relative_to(directory).as_posix()}',
                         content, path)
        for filename, name in sorted(config['agents'].items()):
            source = agent_sources[name]
            meta, body = split_frontmatter(source.read_text())
            if meta['name'] != name:
                raise ValueError(f'Agent name differs from filename: {source}')
            body = render(body, config)
            if config['format'] == 'codex':
                preamble = (adapter / 'preamble.md').read_text()
                body = preamble + body.replace('# System Prompt:', '# Agent Instructions:')
                # Literal TOML strings retain TS/regex escapes and interpolation verbatim.
                instruction = "'''\n" + body + "\n'''" if "'''" not in body else json.dumps(body, ensure_ascii=False)
                text = (f'name = {json.dumps(name)}\n'
                        f'description = {json.dumps(render(meta["description"], config), ensure_ascii=False)}\n'
                        f'developer_instructions = {instruction}\n')
            else:
                meta['description'] = render(meta['description'], config)
                text = markdown_header({**meta, **config['agent_metadata']}, body)
            emit(f'{target}/agents/{filename}', text, source)
        if config['catalog']:
            source = src / 'component_catalog.md'
            emit(f'{target}/{config["catalog"]}', render(source.read_text(), config), source)
        for source in sorted((src / 'references').rglob('*')):
            if not source.is_file():
                continue
            relative = source.relative_to(src / 'references').as_posix()
            directory = config['references']
            if relative == 'architecture_rules.md' and target in {'antigravity', 'agy'}:
                directory = 'rules'
            emit(f'{target}/{directory}/{relative}', render(source.read_text(), config), source)
        for source in sorted((src / 'scripts').glob('*.js')):
            emit(f'{target}/scripts/{source.name}', render(source.read_text(), config), source)
        source = src / 'mcp.json'
        if config['format'] == 'codex':
            servers = json.loads(source.read_text())['mcpServers']
            text = '# Optional: merge into .codex/config.toml only when this server is needed.\n'
            for name, server in servers.items():
                text += f'[mcp_servers.{json.dumps(name)}]\n'
                text += ''.join(f'{key} = {json.dumps(value)}\n' for key, value in server.items())
        else:
            text = source.read_text()
        emit(f'{target}/{config["mcp"]}', text, source)
        for source in sorted((adapter / 'files').rglob('*')):
            if source.is_file():
                emit(f'{target}/{source.relative_to(adapter / "files").as_posix()}',
                     render(source.read_text(), config), source)
    for source in sorted((src / 'examples').rglob('*.md')):
        emit(f'docs/examples/{source.relative_to(src / "examples").as_posix()}', source.read_text(), source)
    source = src / 'plugin-development.md'
    emit('docs/plugin-development.md', source.read_text(), source)
    return outputs


def synchronize(root: Path, outputs: dict[str, bytes], check: bool = False) -> list[str]:
    manifest_path = safe_path(root, MANIFEST)
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    current = {name: digest(data) for name, data in sorted(outputs.items())}
    stale = sorted(previous.keys() - outputs.keys())
    changed = [name for name, data in outputs.items()
               if not safe_path(root, name).exists() or safe_path(root, name).read_bytes() != data]
    drift = changed + [name for name in stale if safe_path(root, name).exists()]
    if previous != current:
        drift.append(MANIFEST)
    if check:
        return sorted(set(drift))
    # Preflight every overwrite/removal before writing anything. User-only files stay untouched.
    for name in changed + stale:
        path = safe_path(root, name)
        if path.exists() and (name not in previous or digest(path.read_bytes()) != previous[name]):
            raise ValueError(f'Local edit or unmanaged file: {name}. Reconcile it into src/ first; '
                             'then restore the last generated version (or move it aside) and rerun.')
    for name in changed:
        path = safe_path(root, name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(outputs[name])
    for name in stale:
        safe_path(root, name).unlink(missing_ok=True)
    encoded = (json.dumps(current, indent=2, sort_keys=True) + '\n').encode()
    if not manifest_path.exists() or manifest_path.read_bytes() != encoded:
        manifest_path.write_bytes(encoded)
    return sorted(set(drift))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Report drift without writing files')
    args = parser.parse_args()
    try:
        outputs = build(ROOT)
        drift = synchronize(ROOT, outputs, check=args.check)
    except (ValueError, KeyError, OSError) as error:
        print(f'Generation failed: {error}', file=sys.stderr)
        return 1
    if args.check and drift:
        print('Outdated generated files:\n' + '\n'.join(drift))
        return 1
    print(f'{"Checked" if args.check else "Generated"} {len(outputs)} files from src/; '
          f'{len(drift)} changed entries.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
