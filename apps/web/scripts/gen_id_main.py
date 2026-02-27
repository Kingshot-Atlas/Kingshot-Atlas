#!/usr/bin/env python3
"""Main script to generate comprehensive Indonesian translation files.
Combines all translation dictionaries and applies them recursively."""

import json
import os
import sys

# Import all translation parts
sys.path.insert(0, os.path.dirname(__file__))
from gen_id_part1 import T1
from gen_id_part2 import T2
from gen_id_part3 import T3
from gen_id_part4 import T4
from gen_id_part5 import T5
from gen_id_part6 import T6
from gen_id_part7 import T7
from gen_id_part8 import T8
from gen_id_part9 import T9
from gen_id_part10 import T10
from gen_id_part11 import T11, KEEP_ENGLISH

# Merge all dictionaries
TRANSLATIONS = {}
for t in [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11]:
    TRANSLATIONS.update(t)

print(f"Total translation entries: {len(TRANSLATIONS)}")

# Load English source
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.dirname(SCRIPT_DIR)
EN_PATH = os.path.join(WEB_DIR, "src", "locales", "en", "translation.json")

with open(EN_PATH, "r", encoding="utf-8") as f:
    en_data = json.load(f)

# Load existing Indonesian file to preserve already-translated content
ID_PUB_PATH = os.path.join(WEB_DIR, "public", "locales", "id", "translation.json")
ID_SRC_PATH = os.path.join(WEB_DIR, "src", "locales", "id", "translation.json")

existing_id = {}
if os.path.exists(ID_PUB_PATH):
    with open(ID_PUB_PATH, "r", encoding="utf-8") as f:
        existing_id = json.load(f)

def translate_value(val):
    """Translate a single string value using the dictionary."""
    if val in TRANSLATIONS:
        return TRANSLATIONS[val]
    return val  # Return original (English fallback)

def translate_obj(en_obj, existing_obj=None):
    """Recursively translate an object, preserving existing translations."""
    if existing_obj is None:
        existing_obj = {}
    
    if isinstance(en_obj, dict):
        result = {}
        for key, val in en_obj.items():
            if key in existing_obj:
                if isinstance(val, dict):
                    result[key] = translate_obj(val, existing_obj.get(key, {}))
                elif isinstance(val, str):
                    existing_val = existing_obj[key]
                    if existing_val != val:
                        # Already translated (different from English)
                        result[key] = existing_val
                    else:
                        # Same as English, try to translate
                        result[key] = translate_value(val)
                else:
                    result[key] = existing_obj[key]
            else:
                if isinstance(val, dict):
                    result[key] = translate_obj(val, {})
                elif isinstance(val, str):
                    result[key] = translate_value(val)
                else:
                    result[key] = val
        return result
    elif isinstance(en_obj, str):
        if existing_obj and isinstance(existing_obj, str) and existing_obj != en_obj:
            return existing_obj
        return translate_value(en_obj)
    return en_obj

# Generate translated data
id_data = translate_obj(en_data, existing_id)

# Count coverage
def count_keys(obj, translated_obj, en_obj):
    total = 0
    translated = 0
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, dict):
                t, tr = count_keys(v, translated_obj.get(k, {}) if isinstance(translated_obj, dict) else {}, en_obj.get(k, {}) if isinstance(en_obj, dict) else {})
                total += t
                translated += tr
            elif isinstance(v, str):
                total += 1
                en_val = en_obj.get(k, v) if isinstance(en_obj, dict) else v
                trans_val = translated_obj.get(k, v) if isinstance(translated_obj, dict) else v
                if trans_val != en_val:
                    translated += 1
                elif en_val in KEEP_ENGLISH:
                    translated += 1  # Intentionally kept in English
    return total, translated

total, translated = count_keys(en_data, id_data, en_data)

# Write output files
os.makedirs(os.path.dirname(ID_PUB_PATH), exist_ok=True)
os.makedirs(os.path.dirname(ID_SRC_PATH), exist_ok=True)

with open(ID_PUB_PATH, "w", encoding="utf-8") as f:
    json.dump(id_data, f, ensure_ascii=False, indent=2)

with open(ID_SRC_PATH, "w", encoding="utf-8") as f:
    json.dump(id_data, f, ensure_ascii=False, indent=2)

print(f"Total string keys: {total}")
print(f"Translated: {translated}")
print(f"Coverage: {translated/total*100:.1f}%")
print(f"Written to:")
print(f"  {ID_PUB_PATH}")
print(f"  {ID_SRC_PATH}")
