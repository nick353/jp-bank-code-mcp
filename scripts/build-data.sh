#!/bin/bash
# zengin-code/source-data から data/zengin.json を作り直す（月1回ほど）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
curl -sL -o "$TMP/src.tar.gz" https://codeload.github.com/zengin-code/source-data/tar.gz/refs/heads/master
tar xzf "$TMP/src.tar.gz" -C "$TMP"
python3 -I - "$(ls -d "$TMP"/*/data)" "$ROOT/data/zengin.json" <<'PY'
import sys, json, os
S, out_path = sys.argv[1], sys.argv[2]
banks = json.load(open(S + '/banks.json', encoding='utf-8'))
out = {}
for code, b in sorted(banks.items()):
    p = f"{S}/branches/{code}.json"
    br = {c: [x['name'], x['kana']] for c, x in sorted(json.load(open(p, encoding='utf-8')).items())} if os.path.exists(p) else {}
    out[code] = {'n': b['name'], 'k': b['kana'], 'r': b.get('roma', ''), 'b': br}
json.dump({'updated_at': open(S + '/updated_at').read().strip(), 'banks': out}, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'banks')
PY
rm -rf "$TMP"
