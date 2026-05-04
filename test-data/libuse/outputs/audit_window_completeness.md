# Audit Part D — Window W## completeness

Per W## type, verifies osazení + parapet + spárování items exist.

Note: Window dodávka NOT in scope (window itself bought separately, fasáda dodavatel responsibility).

Required base items per window type:
  - `HSV-642` Osazení okenního rámu
  - `HSV-642` Kotvení (turbo)
  - `HSV-642` PUR pěna připojovací spáry
  - `HSV-642` Komprimační páska připojovací
  - `HSV-642` Spárování okenního rámu silikon + akrylát
  - `PSV-766` Vnitřní parapety umělý kámen
  - `PSV-764` Vnější parapet pozinkovaný plech

Roof-light extras (střešní okna ~11 ks):
  - `HSV-642` Lemování střešního okna
  - `HSV-642` Difuzní límec
  - `HSV-642` Parotěsná manžeta
  - `PSV-764` Krycí lemování plechové

## Per-window-type gaps

| W-code | Count | Missing items |
|---|---:|---|
| `W03` | 17 | Vnitřní parapety umělý kámen; Vnější parapet pozinkovaný plech |
| `W05` | 9 | Vnitřní parapety umělý kámen; Vnější parapet pozinkovaný plech |
| `W04` | 4 | Vnitřní parapety umělý kámen; Vnější parapet pozinkovaný plech |
| `W01` | 3 | Vnitřní parapety umělý kámen; Vnější parapet pozinkovaný plech |
| `W83` | 2 | Vnitřní parapety umělý kámen; Vnější parapet pozinkovaný plech |

**Total gaps**: 10 across 5 W-types
**Roof-light items present**: 3 (expected ≥ 4 per cat × 11 ks ≈ 44+)

## Recommendation

⚠️ **MEDIUM priority** — verify completeness. Most likely gap: vnější parapet PSV-764 missing per-W-type (added globally in Phase 3e).