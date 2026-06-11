---
name: modify-manifest
description: 'Guides developers and AI agents on adding/editing permissions under the root `"permissions"` array, and structuring schema migrations (new entities, fields, or sequences) under the `"dbVersions"` array.'
---

# Agent Skill: Modify Manifest Configuration in Glyvio

This document defines a structured AI agent skill. Other AI coding agents or developers can load and execute this skill to include or edit entities, fields, sequences, and permissions within a Glyvio plugin's `manifest.json` file.

---

## 🎯 Skill Metadata

- **Name**: `modify_manifest`
- **Description**: Guides developers and AI agents on adding/editing permissions under the root `"permissions"` array, and structuring schema migrations (new entities, fields, or sequences) under the `"dbVersions"` array.
- **Audience**: AI agents or developers with write access to a Glyvio plugin codebase.

---

## 📥 Required Input Parameters

To run this skill, the agent must obtain or ask for the following inputs:

1. **Target modification type**:
   - **Permissions**: Add new view or page access permissions.
   - **New Entity**: Add a completely new database table.
   - **New/Modified Fields**: Add or change fields on existing entities.
   - **Sequences**: Add an auto-increment sequence and bind it to a field.
2. **Parameters for Permissions**:
   - `key` (e.g., `invoice_list_page`): Unique key for the permission.
   - `subtype` (e.g., `invoice`): Context/Entity classification.
   - `label` (optional, e.g., `Lista de Faturas`): User-friendly display label.
3. **Parameters for Entities & Fields**:
   - `friendlyName` (e.g., `invoice`): Snake-case entity or field name.
   - `dataType` (e.g., `TEXT`, `BOOLEAN`, `INTEGER`, `DECIMAL`, `TIMESTAMP`, `JSON`): Data type of the field.
   - `config` details (e.g., `notNull: true`, foreign key references, sequences).

---

## 🚫 Environment Constraints & Rules

The executing agent MUST strictly adhere to these rules:

1. **Incremental Database Versions**: Never modify a past database migration block inside `"dbVersions"`. To add or edit entities/fields/sequences, you MUST append a new database version object at the end of `"dbVersions"` with an incremented `versionNumber` (e.g. if the last version was 45, add version 46).
2. **Naming Conventions**: Use `snake_case` for all entity friendlyNames, field friendlyNames, sequence names, and permission keys.
3. **Unique Permission Keys**: The permission `key` must be globally unique inside the manifest file.
4. **Valid Data Types**: Ensure `dataType` matches one of the supported database types: `TEXT`, `BOOLEAN`, `INTEGER`, `DECIMAL`, `TIMESTAMP`, `JSON`, etc.
5. **Foreign Keys**: When creating a foreign key, the `entity` name must match the friendlyName of the referenced entity and the friendlyName of the field must end with `_id`.

---

## 📋 Execution Steps

The agent must perform the following actions:

### Step 1: Open `manifest.json`

Locate the `manifest.json` file in the root of the plugin project.

### Step 2: Apply Permissions Modification (If Required)

To register a new permission (for example, to restrict access to a new view page or modal), append a new object to the root-level `"permissions"` array.

### Step 3: Apply Database Schema Migration (If Required)

To add/modify/remove entities, fields, or sequences, find the last version entry in `"dbVersions"`. Append a new version block:

1. Increment the `"versionNumber"` by 1.
2. Define the new/modified/removed `"entities"` and/or `"sequences"` within this version block.

---

## 📄 JSON Blueprint (Examples)

### 1. Adding a Permission

Add this template object inside the root-level `"permissions"` array:

```json
{
  "type": "view",
  "subtype": "<entity_snake_case>",
  "key": "<permission_key_snake_case>",
  "label": "<Optional Display Label>"
}
```

### 2. Creating a New Entity & Fields

Add a new database version entry at the end of the `"dbVersions"` array:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<entity_snake_case>",
      "fields": [
        {
          "friendlyName": "code",
          "dataType": "TEXT",
          "config": {
            "notNull": true,
            "unique": true
          }
        },
        {
          "friendlyName": "name",
          "dataType": "TEXT"
        },
        {
          "friendlyName": "price",
          "dataType": "DECIMAL",
          "config": {
            "notNull": true,
            "defaultValue": "0.0",
            "decimalPrecision": 10,
            "decimalScale": 2
          }
        },
        {
          "friendlyName": "user_id",
          "dataType": "TEXT",
          "config": {
            "notNull": true,
            "foreignKey": {
              "entity": "app_user",
              "physical": true
            }
          }
        }
      ]
    }
  ]
}
```

### 3. Adding a Field to an Existing Entity

Create a new database version specifying the target existing entity name and the new fields list:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<existing_entity_name>",
      "fields": [
        {
          "friendlyName": "<new_field_name>",
          "dataType": "<DataType>",
          "config": {
            "notNull": false,
            "foreignKey": {
              "entity": "<referenced_entity_name>",
              "physical": true
            }
          }
        }
      ]
    }
  ]
}
```

### 3. Removing a Entity

Create a new database version specifying the target existing entity name and the new fields list:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<existing_entity_name>",
      "deleted": true
    }
  ]
}
```

### 4. Removing a Field from an Existing Entity

Create a new database version specifying the target existing entity name and the new fields list:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<existing_entity_name>",
      "fields": [
        {
          "friendlyName": "<existing_field_name>",
          "deleted": true
        }
      ]
    }
  ]
}
```

### 5. Declaring and Binding a Sequence

Add a sequence declaration in the version block, and bind it inside a field's config details:

```json
{
  "versionNumber": <NextVersionNumberInteger>,
  "entities": [
    {
      "friendlyName": "<entity_name>",
      "fields": [
        {
          "friendlyName": "code",
          "dataType": "TEXT",
          "config": {
            "sequence": {
              "name": "<sequence_name_snake_case>"
            }
          }
        }
      ]
    }
  ],
  "sequences": [
    {
      "friendlyName": "<sequence_name_snake_case>"
    }
  ]
}
```
