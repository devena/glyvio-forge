#!/usr/bin/env python3
import os
import re
import shutil
import sys

def sanitize_name(name):
    # Lowercase, replace underscores and spaces with hyphens, remove any other non-alphanumeric/hyphen chars
    name = name.lower()
    name = re.sub(r'[_ ]', '-', name)
    name = re.sub(r'[^a-z0-9\-]', '', name)
    # Remove redundant hyphens
    name = re.sub(r'-+', '-', name)
    return name.strip('-')

def parse_frontmatter(content):
    frontmatter_match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if frontmatter_match:
        frontmatter_str = frontmatter_match.group(1)
        body = content[frontmatter_match.end():]
        metadata = {}
        for line in frontmatter_str.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if ':' in line:
                k, v = line.split(':', 1)
                # Strip quotes
                val = v.strip().strip("'").strip('"')
                metadata[k.strip()] = val
        return metadata, body
    return None, content

def convert_agents(source_dir, target_dir):
    agents_src = os.path.join(source_dir, 'agents')
    agents_dst = os.path.join(target_dir, 'agents')

    if not os.path.exists(agents_src):
        print(f"No agents directory found at {agents_src}")
        return

    os.makedirs(agents_dst, exist_ok=True)
    print(f"Converting agents from {agents_src} to {agents_dst}...")

    for filename in os.listdir(agents_src):
        if not filename.endswith('.md') or filename.startswith('.'):
            continue

        src_file_path = os.path.join(agents_src, filename)
        with open(src_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        metadata, body = parse_frontmatter(content)

        if metadata:
            name = metadata.get('name')
            description = metadata.get('description', '')
        else:
            # Generate metadata from file name and first paragraph
            name_base = filename.rsplit('.', 1)[0]
            if name_base.endswith('_prompt'):
                name_base = name_base[:-7]
            name = sanitize_name(name_base)
            
            # Try to find a description from the first paragraph
            lines = [l.strip() for l in body.split('\n') if l.strip()]
            description = ""
            for line in lines:
                if line.startswith('#'):
                    continue
                # Use first non-header line as description snippet
                description = line[:200]
                if len(line) > 200:
                    description += "..."
                break
            if not description:
                description = f"Custom agent converted from {filename}"

        name = sanitize_name(name)
        agent_dir = os.path.join(agents_dst, name)
        os.makedirs(agent_dir, exist_ok=True)

        # Re-write the agent file with clean frontmatter (name, description)
        target_file_path = os.path.join(agent_dir, 'agent.md')
        
        # Build clean frontmatter
        clean_frontmatter = f"---\nname: {name}\ndescription: {description}\n---\n\n"
        
        with open(target_file_path, 'w', encoding='utf-8') as f:
            f.write(clean_frontmatter + body.lstrip())

        print(f"  - Converted agent '{name}' -> {target_file_path}")

def convert_skills(source_dir, target_dir):
    skills_src = os.path.join(source_dir, 'skills')
    skills_dst = os.path.join(target_dir, 'skills')

    if not os.path.exists(skills_src):
        print(f"No skills directory found at {skills_src}")
        return

    os.makedirs(skills_dst, exist_ok=True)
    print(f"Converting skills from {skills_src} to {skills_dst}...")

    for skill_folder in os.listdir(skills_src):
        src_skill_dir = os.path.join(skills_src, skill_folder)
        if not os.path.isdir(src_skill_dir) or skill_folder.startswith('.'):
            continue

        skill_name = sanitize_name(skill_folder)
        dst_skill_dir = os.path.join(skills_dst, skill_name)
        os.makedirs(dst_skill_dir, exist_ok=True)

        # Copy all files in the skill directory
        for item in os.listdir(src_skill_dir):
            src_item_path = os.path.join(src_skill_dir, item)
            dst_item_path = os.path.join(dst_skill_dir, item)
            
            if os.path.isdir(src_item_path):
                shutil.copytree(src_item_path, dst_item_path, dirs_exist_ok=True)
            else:
                shutil.copy2(src_item_path, dst_item_path)

        print(f"  - Converted skill '{skill_name}' -> {dst_skill_dir}")

def copy_other_resources(source_dir, target_dir):
    # Check if there are rules/reference docs to copy
    # e.g., component_catalog.md -> rules/component_catalog.md
    catalog_src = os.path.join(source_dir, 'component_catalog.md')
    if os.path.exists(catalog_src):
        rules_dst = os.path.join(target_dir, 'rules')
        os.makedirs(rules_dst, exist_ok=True)
        dst_catalog_path = os.path.join(rules_dst, 'component_catalog.md')
        shutil.copy2(catalog_src, dst_catalog_path)
        print(f"  - Copied component catalog as rule -> {dst_catalog_path}")

def main():
    workspace_root = os.getcwd()
    source_dir = os.path.join(workspace_root, 'claude')
    target_dir = os.path.join(workspace_root, '.agents')

    if len(sys.argv) > 1:
        source_dir = sys.argv[1]
    if len(sys.argv) > 2:
        target_dir = sys.argv[2]

    if not os.path.exists(source_dir):
        print(f"Source directory {source_dir} does not exist.")
        sys.exit(1)

    print(f"Starting conversion from '{source_dir}' to '{target_dir}'...")
    convert_agents(source_dir, target_dir)
    convert_skills(source_dir, target_dir)
    copy_other_resources(source_dir, target_dir)
    print("Conversion completed successfully!")

if __name__ == '__main__':
    main()
