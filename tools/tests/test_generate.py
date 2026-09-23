"""Behavioral tests for rendering, propagation and protection of local changes."""
import importlib.util
import json
from pathlib import Path
import re
import shutil
import tempfile
import tomllib
import unittest

REPO = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('generate', REPO / 'tools/generate.py')
generate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generate)


class GeneratorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        shutil.copytree(REPO / 'src', self.root / 'src')

    def initial_generation(self):
        output = generate.build(self.root)
        generate.synchronize(self.root, output)
        return output

    def test_deterministic_complete_generation_and_native_formats(self):
        output = self.initial_generation()
        self.assertEqual(generate.build(self.root), output)
        self.assertEqual(generate.synchronize(self.root, output, check=True), [])
        timestamps = {name: (self.root / name).stat().st_mtime_ns for name in output}
        self.assertEqual(generate.synchronize(self.root, output), [])
        self.assertEqual(timestamps, {name: (self.root / name).stat().st_mtime_ns for name in output})
        expected_skills = {p.parent.name for p in (self.root / 'src/skills').glob('*/SKILL.md')}
        for target in ['claude', 'codex', 'antigravity', 'opencode']:
            config = json.loads((self.root / f'src/adapters/{target}/config.json').read_text())
            output_root = config.get('output', target)
            found = {Path(p).parent.name for p in output
                     if p.startswith(f'{output_root}/skills/') and p.endswith('/SKILL.md')}
            self.assertEqual(found, expected_skills)
            self.assertEqual(sum(p.startswith(f'{output_root}/agents/') for p in output), 6)
        self.assertEqual(sum(p.startswith('agy/skills/') for p in output), 3)
        for name, data in output.items():
            if name.endswith('.toml'):
                metadata = tomllib.loads(data.decode())
                if '/agents/' in name:
                    self.assertEqual(set(metadata), {'name', 'description', 'developer_instructions'})
            self.assertNotIn(b'@@', data, name)
        claude = (self.root / 'claude/skills/external-user-api/SKILL.md').read_text()
        codex = (self.root / 'codex/skills/external-user-api/SKILL.md').read_text()
        self.assertIn('CLAUDE.md', claude)
        self.assertIn('AGENTS.md', codex)
        self.assertNotIn('CLAUDE.md', codex)
        opencode_agent = output['opencode/.opencode/agents/glyvio-app-chart.md'].decode()
        self.assertIn('mode: "all"', opencode_agent)
        self.assertNotIn('@@', opencode_agent)
        opencode_config = json.loads(output['opencode/.opencode/opencode.jsonc'].decode())
        self.assertEqual(opencode_config, {'$schema': 'https://opencode.ai/config.json'})
        mcp = output['opencode/.opencode/mcp.example.jsonc'].decode()
        self.assertIn('"type": "local"', mcp)
        self.assertIn('"command": [', mcp)

    def test_source_change_propagates_to_all_selected_packages(self):
        before = self.initial_generation()
        source = self.root / 'src/skills/test-plugin-browser/SKILL.md'
        source.write_text(source.read_text() + '\nAdditional browser scenario guidance.\n')
        after = generate.build(self.root)
        expected = {f'{t}/skills/test-plugin-browser/SKILL.md' for t in ['claude', 'codex', 'antigravity', 'agy']}
        expected.add('opencode/.opencode/skills/test-plugin-browser/SKILL.md')
        self.assertEqual({name for name in after if before[name] != after[name]}, expected)
        self.assertEqual(set(generate.synchronize(self.root, after, check=True)), expected | {generate.MANIFEST})
        # Check did not write any of the old outputs.
        for name in expected:
            self.assertEqual((self.root / name).read_bytes(), before[name])
        generate.synchronize(self.root, after)
        self.assertEqual(generate.synchronize(self.root, after, check=True), [])

    def test_local_edit_blocks_all_writes_and_preserves_other_files(self):
        before = self.initial_generation()
        path = self.root / 'claude/skills/test-plugin-browser/SKILL.md'
        path.write_text(path.read_text() + '\nLocal edit not reconciled.\n')
        source = self.root / 'src/component_catalog.md'
        source.write_text(source.read_text() + '\nNew canonical note.\n')
        after = generate.build(self.root)
        with self.assertRaisesRegex(ValueError, 'Local edit'):
            generate.synchronize(self.root, after)
        self.assertEqual((self.root / 'antigravity/rules/component_catalog.md').read_bytes(),
                         before['antigravity/rules/component_catalog.md'])
        self.assertIn('Local edit not reconciled', path.read_text())
        self.assertIn('claude/skills/test-plugin-browser/SKILL.md',
                      generate.synchronize(self.root, after, check=True))

    def test_unmanaged_file_conflict_requires_reconciliation(self):
        output = generate.build(self.root)
        path = self.root / 'codex/component_catalog.md'
        path.parent.mkdir(parents=True)
        path.write_text('Unmanaged local content')
        with self.assertRaisesRegex(ValueError, 'unmanaged file'):
            generate.synchronize(self.root, output)
        self.assertEqual(path.read_text(), 'Unmanaged local content')
        self.assertFalse((self.root / generate.MANIFEST).exists())
        self.assertFalse((self.root / 'claude').exists())

    def test_removed_skill_removes_only_unchanged_managed_outputs(self):
        self.initial_generation()
        extra = self.root / 'claude/skills/synced/local/SKILL.md'
        extra.parent.mkdir(parents=True)
        extra.write_text('Local synced skill')
        shutil.rmtree(self.root / 'src/skills/create-notification')
        after = generate.build(self.root)
        generate.synchronize(self.root, after)
        for target in ['claude', 'codex', 'antigravity']:
            self.assertFalse((self.root / target / 'skills/create-notification/SKILL.md').exists())
        self.assertEqual(extra.read_text(), 'Local synced skill')
        self.assertEqual(generate.synchronize(self.root, after, check=True), [])

    def test_modified_obsolete_output_is_not_deleted(self):
        self.initial_generation()
        path = self.root / 'codex/skills/create-notification/SKILL.md'
        path.write_text('Local replacement')
        shutil.rmtree(self.root / 'src/skills/create-notification')
        with self.assertRaisesRegex(ValueError, 'Local edit'):
            generate.synchronize(self.root, generate.build(self.root))
        self.assertEqual(path.read_text(), 'Local replacement')
        self.assertTrue((self.root / 'claude/skills/create-notification/SKILL.md').exists())

    def test_unknown_tokens_and_incomplete_agent_mappings_fail_before_writes(self):
        source = self.root / 'src/component_catalog.md'
        original = source.read_text()
        source.write_text(original + '\n@@MISSING_TOKEN@@')
        with self.assertRaisesRegex(ValueError, 'Unsupported token'):
            generate.build(self.root)
        self.assertFalse((self.root / 'claude').exists())
        source.write_text(original)
        config = self.root / 'src/adapters/codex/config.json'
        data = json.loads(config.read_text())
        del data['agents']['glyvio-app-chart.toml']
        config.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'every canonical agent'):
            generate.build(self.root)

    def test_skill_assets_are_preserved_byte_for_byte(self):
        source = self.root / 'src/skills/create-controller/assets/example.bin'
        source.parent.mkdir()
        payload = b'\x00\xff@@BINARY_LITERAL@@\x80'
        source.write_bytes(payload)
        output = generate.build(self.root)
        for target in ['claude', 'codex', 'antigravity', 'opencode']:
            config = json.loads((self.root / f'src/adapters/{target}/config.json').read_text())
            output_root = config.get('output', target)
            self.assertEqual(output[f'{output_root}/skills/create-controller/assets/example.bin'], payload)

    def test_output_paths_cannot_escape_repository(self):
        with self.assertRaises(ValueError):
            generate.safe_path(self.root, '../outside')
        with self.assertRaises(ValueError):
            generate.safe_path(self.root, '/outside')
        with tempfile.TemporaryDirectory() as outside:
            (self.root / 'codex').symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, 'outside project'):
                generate.build(self.root)
            self.assertEqual(list(Path(outside).iterdir()), [])

    def test_reconciled_knowledge_survives_all_full_packages(self):
        output = generate.build(self.root)
        for target, directory in [('claude', 'references'), ('codex', 'references'),
                                  ('antigravity', 'rules/references'), ('opencode', 'references')]:
            config = json.loads((self.root / f'src/adapters/{target}/config.json').read_text())
            output_root = config.get('output', target)
            catalog = output[f'{output_root}/{directory}/component_catalog_full.md'].decode()
            for topic in ['SimpleMasterDetailPageDesign', 'masterPanelWidth', 'TreeLayoutDesign',
                          'ChoiceMultipleTextfieldDesign', 'TextFieldsChoiceWidget._addValue']:
                self.assertIn(topic, catalog)
            browser = output[f'{output_root}/skills/test-plugin-browser/SKILL.md'].decode()
            for topic in ['GLYVIO_PASSWORD', 'waitForScreen', 'fireAndTolerate']:
                self.assertIn(topic, browser)
            controller = output[f'{output_root}/skills/create-controller/SKILL.md'].decode()
            self.assertIn('restService.postController', controller)
            self.assertNotIn('`src/behavior_listeners/index.ts`', controller)
        self.assertIn(b'restService.postController', output['docs/examples/server/controller.md'])

    def test_literal_typescript_survives_toml_round_trip(self):
        source = self.root / 'src/agents/glyvio-app-chart.md'
        snippet = "\nconst expression = /\\b\\w+/;\nconst template = '$S{state.value}';\nconst quotes = \"'''\";\n"
        source.write_text(source.read_text() + snippet)
        output = generate.build(self.root)
        agent = tomllib.loads(output['codex/agents/glyvio-app-chart.toml'].decode())
        self.assertIn(snippet, agent['developer_instructions'])

    def test_generated_links_and_runtime_references_resolve(self):
        output = self.initial_generation()
        for name, data in output.items():
            if not name.endswith('.md'):
                continue
            # Ignore Markdown demonstrated inside code, such as [text](url).
            text = re.sub(r'```.*?```', '', data.decode(), flags=re.S)
            text = re.sub(r'`[^`\n]*`', '', text)
            for link in re.findall(r'\]\(([^)\s]+)\)', text):
                if link.startswith(('http:', 'https:', '#', 'mailto:')):
                    continue
                destination = self.root / Path(name).parent / link.split('#')[0]
                self.assertTrue(destination.exists(), (name, link))
        for target in ['claude', 'codex', 'antigravity', 'agy', 'opencode']:
            config = json.loads((self.root / f'src/adapters/{target}/config.json').read_text())
            output_root = config.get('output', target)
            base = config['runtime_root']
            pattern = re.compile(r'(?<![\w/.-])' + re.escape(base) + r'/[a-zA-Z0-9_./-]+\.(?:md|toml|js)')
            for name, data in output.items():
                if not name.startswith(output_root + '/') or not name.endswith(('.md', '.toml')):
                    continue
                for reference in pattern.findall(data.decode()):
                    destination = output_root + '/' + reference[len(base) + 1:]
                    self.assertIn(destination, output, (name, reference))

    def test_canonical_skill_references_resolve(self):
        skill_names = {path.parent.name for path in (self.root / 'src/skills').glob('*/SKILL.md')}
        markdown_sources = list((self.root / 'src').rglob('*.md'))
        for source in markdown_sources:
            text = source.read_text()
            for reference in re.findall(r'\[\[([a-z0-9-]+)\]\]', text):
                self.assertIn(reference, skill_names, (source, reference))

        guide = (self.root / 'src/plugin-development.md').read_text()
        documented = re.findall(r'^\| `/([a-z0-9-]+)`', guide, flags=re.M)
        for reference in documented:
            self.assertIn(reference, skill_names, ('src/plugin-development.md', reference))


if __name__ == '__main__':
    unittest.main()
