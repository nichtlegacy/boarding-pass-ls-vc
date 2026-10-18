# Fonts

All are licensed under the SIL Open Font License 1.1 (see `OFL.txt`, one copy per family). Every file is produced by [`scripts/fonts.sh`](../../scripts/fonts.sh) from the upstream TTFs in [google/fonts](https://github.com/google/fonts) and committed, so the Pages runner needs no font tooling.

| File | Font | Source | Notes |
| --- | --- | --- | --- |
| `onest-var.woff2` | Onest 100–900 | `ofl/onest/Onest[wght].ttf` | page UI and display type; variable, subset to Latin-1, Latin Extended-A and common punctuation |
| `carlito-400.woff2` | GT406 Sans Regular | `ofl/carlito/Carlito-Regular.ttf` | ticket labels; subset to the name range |
| `carlito-700.woff2` | GT406 Sans Bold | `ofl/carlito/Carlito-Bold.ttf` | ticket values and names; subset to the name range |
| `carlito-700i.woff2` | GT406 Sans Bold Italic | `ofl/carlito/Carlito-BoldItalic.ttf` | ticket disclaimer; basic Latin subset |
| `archivo-expanded-900.woff2` | Archivo Expanded 900 | `ofl/archivo/Archivo[wdth,wght].ttf` | airport codes and sign words; static instance wdth 125 / wght 900, uppercase, digits and punctuation only |
| `arimo-700i.woff2` | Arimo Bold Italic | `ofl/arimo/Arimo-Italic[wght].ttf` | ticket slogan; static instance wght 700, basic Latin subset |
| `urbanist-500.woff2` | Urbanist 500 | `ofl/urbanist/Urbanist[wght].ttf` | countdown digits, hero line, dock and cast labels; static instance wght 500, subset like Onest |

**GT406 Sans is a renamed subset of Carlito.** Carlito is released with the Reserved Font Name "Carlito", and a subset counts as a Modified Version under the OFL, so `fonts.sh` rewrites the name table of the three subsets (family `GT406 Sans`, PostScript names `GT406Sans-Regular`, `GT406Sans-Bold`, `GT406Sans-BoldItalic`). The copyright and licence records are kept. Font stacks name `Carlito` and `Calibri` only as locally installed fallbacks.

Coverage: the GT406 Sans subset equals the name allowlist in `site/js/passenger.js` (`cleanName`), plus `→`. `fonts.sh` fails if any allowed code point is missing from the Regular or Bold subset.
