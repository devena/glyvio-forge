#!/usr/bin/env python3
"""Link the generated Glyvio Forge OpenCode package into global OpenCode discovery."""
from __future__ import annotations

import argparse
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'opencode'


def ensure_link(source: Path, destination: Path) -> str:
    if not source.exists():
        raise ValueError(f'Missing generated source: {source}. Run tools/generate.py first.')
    if destination.is_symlink():
        if destination.resolve() == source.resolve():
            return f'unchanged {destination}'
        raise ValueError(f'Refusing to replace existing link: {destination} -> {destination.resolve()}')
    if destination.exists():
        raise ValueError(f'Refusing to replace existing file or directory: {destination}')
    destination.symlink_to(source, target_is_directory=source.is_dir())
    return f'linked {destination} -> {source}'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config-dir', type=Path, default=Path.home() / '.config/opencode',
                        help='Global OpenCode configuration directory (default: ~/.config/opencode)')
    args = parser.parse_args()
    destination = args.config_dir.expanduser()
    package = SOURCE / '.opencode'
    links = {
        SOURCE / 'AGENTS.md': destination / 'AGENTS.md',
        package / 'agents': destination / 'agents',
        package / 'skills': destination / 'skills',
        package / 'references': destination / 'references',
        package / 'scripts': destination / 'scripts',
        package / 'component_catalog.md': destination / 'component_catalog.md',
        package / 'mcp.example.jsonc': destination / 'mcp.example.jsonc',
    }
    try:
        destination.mkdir(parents=True, exist_ok=True)
        for source, target in links.items():
            print(ensure_link(source, target))
    except (OSError, ValueError) as error:
        print(f'Global OpenCode link failed: {error}', file=sys.stderr)
        return 1
    print('Restart OpenCode or start a new session to load the global Glyvio Forge package.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
