#!/usr/bin/env bash
# Downloads, instances and subsets the site fonts into site/fonts/. Outputs are committed;
# the Pages runner needs no font tooling.
#
# Carlito is OFL with the Reserved Font Name "Carlito". A subset is a Modified Version, so the
# three Carlito outputs are renamed to "GT406 Sans" below; Archivo, Arimo, Onest and Urbanist declare
# no RFN and keep their names.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; W=/tmp/bp-fonts; mkdir -p "$W"
[ -d "$W/venv" ] || python3 -m venv "$W/venv"; "$W/venv/bin/pip" -q install fonttools brotli pillow skia-pathops
G=https://raw.githubusercontent.com/google/fonts/main
get(){ [ -f "$W/$2" ] || curl -fsSL -o "$W/$2" "$G/$1"; }
get 'ofl/onest/Onest%5Bwght%5D.ttf' Onest.ttf
get ofl/carlito/Carlito-Regular.ttf Carlito-Regular.ttf; get ofl/carlito/Carlito-Bold.ttf Carlito-Bold.ttf
get ofl/carlito/Carlito-BoldItalic.ttf Carlito-BoldItalic.ttf
get 'ofl/archivo/Archivo%5Bwdth,wght%5D.ttf' Archivo.ttf; get 'ofl/archivo/Archivo-Italic%5Bwdth,wght%5D.ttf' Archivo-Italic.ttf
get 'ofl/arimo/Arimo-Italic%5Bwght%5D.ttf' Arimo-Italic.ttf
get 'ofl/urbanist/Urbanist%5Bwght%5D.ttf' Urbanist.ttf
for f in onest carlito archivo arimo urbanist; do get "ofl/$f/OFL.txt" "OFL-$f.txt"; done
PY="$W/venv/bin/python -I"; O="$ROOT/site/fonts"; mkdir -p "$O"
NAME='U+0020-007E,U+00A0-00AC,U+00AE-024F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03CE,U+03D0-03FF,U+0400-0475,U+0477-0486,U+0488-04FF,U+1E00-1E9B,U+1E9E,U+1EA0-1EF9,U+2013-2014,U+2018-2019,U+201C-201D,U+2022,U+2026,U+2192'
BASIC='U+0020-007E,U+00A0,U+00B7,U+2013-2014,U+2019,U+2026,U+2192'
CODES='U+0020-005F,U+00B7,U+2192'
UI='U+0020-007E,U+00A0-017F,U+2010-2027,U+2030,U+2039-203A,U+20AC,U+2190-2193,U+2212'
$PY -m fontTools.varLib.instancer "$W/Archivo.ttf" wdth=125 wght=900 -q -o "$W/archivo-x900.ttf"
$PY -m fontTools.varLib.instancer "$W/Arimo-Italic.ttf" wght=700 -q -o "$W/arimo-700i.ttf"
$PY -m fontTools.varLib.instancer "$W/Urbanist.ttf" wght=500 -q -o "$W/urbanist-500.ttf"
sub(){ $PY -m fontTools.subset "$1" --unicodes="$2" --flavor=woff2 --no-hinting --output-file="$O/$3"; }
sub "$W/Carlito-Regular.ttf" "$NAME" carlito-400.woff2
sub "$W/Carlito-Bold.ttf" "$NAME" carlito-700.woff2
sub "$W/Carlito-BoldItalic.ttf" "$BASIC" carlito-700i.woff2
sub "$W/archivo-x900.ttf" "$CODES" archivo-expanded-900.woff2
sub "$W/arimo-700i.ttf" "$BASIC" arimo-700i.woff2
sub "$W/urbanist-500.ttf" "$UI" urbanist-500.woff2
$PY -m fontTools.subset "$W/Onest.ttf" --unicodes="$UI" --flavor=woff2 --output-file="$O/onest-var.woff2"
# Rename the Carlito subsets (RFN). File names stay carlito-*.woff2; only the name table changes.
# The copyright (0) and licence (13/14) records are kept as the OFL requires.
$PY - "$O" <<'EOF'
import sys
from fontTools.ttLib import TTFont
out = sys.argv[1]
for fn, style, ps in (('carlito-400', 'Regular', 'Regular'), ('carlito-700', 'Bold', 'Bold'),
                      ('carlito-700i', 'Bold Italic', 'BoldItalic')):
    path = f'{out}/{fn}.woff2'
    f = TTFont(path)
    names = {1: 'GT406 Sans', 3: f'GT406Sans-{ps};subset', 4: f'GT406 Sans {style}', 6: f'GT406Sans-{ps}',
             16: 'GT406 Sans', 17: style, 21: 'GT406 Sans', 22: style}
    for r in f['name'].names:
        if r.nameID in names: r.string = names[r.nameID]
    left = [r.nameID for r in f['name'].names if r.nameID not in (0, 13, 14) and 'Carlito' in r.toUnicode()]
    if left: sys.exit(f'{fn}: "Carlito" still in nameIDs {left}')
    f.flavor = 'woff2'; f.save(path)
print('renamed GT406 Sans')
EOF
# Coverage assert: every NAME code point must exist in Carlito 400 and 700 (allowlist == subset).
$PY - "$NAME" "$O/carlito-400.woff2" "$O/carlito-700.woff2" <<'EOF'
import sys
from fontTools.ttLib import TTFont
cps=set()
for part in sys.argv[1].split(','):
    a,_,b=part[2:].partition('-'); cps.update(range(int(a,16),int(b or a,16)+1))
for fn in sys.argv[2:]:
    miss=sorted(c for c in cps if c not in TTFont(fn).getBestCmap())
    if miss: sys.exit(f'{fn} misses {len(miss)}: '+' '.join(f'U+{c:04X}' for c in miss[:20]))
print('coverage ok')
EOF
{ for f in onest carlito archivo arimo urbanist; do echo "== ${f^} =="; cat "$W/OFL-$f.txt"; echo; done; } > "$O/OFL.txt"
ls -l "$O"
