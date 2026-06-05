"""
SO202 RECON — cross-document consistency (Výstup 3). Read-only.
Compares the XML soupis (ground-truth machine-readable) + TZ raw text against the
validated golden seed. No production code touched.
"""
from __future__ import annotations
import os, sys, re, json
from pathlib import Path
import xml.etree.ElementTree as ET

CB = "/home/user/STAVAGENT/concrete-agent/packages/core-backend"
sys.path.insert(0, CB)
CORPUS = Path("/home/user/STAVAGENT/test-data/SO_202_D6_OV_Z")
OUT = Path("/home/user/STAVAGENT/docs/audits/so202_corpus_recon/_recon_scripts/cross_check_results.json")

XML = CORPUS / "E_Soupis praci_XC4_DI-009.xml"
TZ  = CORPUS / "202_01_TechnickaZprava.pdf"

CC_RE = re.compile(r"C\s*(\d{2,3})\s*/\s*(\d{2,3})")
EXP_RE = re.compile(r"X[CDSFAW]\d")

# Golden seed — soupis betonové prvky (task table)
GOLDEN = {
    "272325": {"prvek": "Základy",            "typ": "Základy pilířů",   "objem": 867.136,  "vyztuz": "150"},
    "317325": {"prvek": "Římsy",              "typ": "Římsa",            "objem": 266.328,  "vyztuz": "113"},
    "333325": {"prvek": "Opěry A KŘÍDLA",     "typ": "Opěry (bundled)",  "objem": 557.851,  "vyztuz": "115"},
    "334326": {"prvek": "Pilíře",            "typ": "Dříky pilířů",     "objem": 361.384,  "vyztuz": "173"},
    "420324": {"prvek": "Přechodové desky",   "typ": "Přechodová deska", "objem": 81.900,   "vyztuz": "151"},
    "422336": {"prvek": "NK trám předpjatá",  "typ": "Mostovková deska", "objem": 2697.941, "vyztuz": "174 měkká + 31 předp."},
}

def loc(t): return t.split('}')[-1] if t else t
def ftext(el, tag):
    for c in el:
        if loc(c.tag).lower() == tag.lower():
            return (c.text or "").strip()
    return ""

res = {"golden_match": [], "concrete_items_all": [], "concrete_classes_in_soupis": {},
       "exposures_in_soupis": [], "tz_geometry_presence": {}, "notes": []}

# ---- 1. Parse soupis polozky ----
tree = ET.parse(str(XML)); root = tree.getroot()
items = []
for el in root.iter():
    if loc(el.tag).lower() != "polozka":
        continue
    znacka = ftext(el, "znacka")
    popis  = ftext(el, "popis") or ftext(el, "nazev")
    nazev  = ftext(el, "nazev")
    mnoz   = ftext(el, "mnozstvi")
    mj     = ftext(el, "id_mj")
    cs     = ftext(el, "cenova_soustava")
    vym    = ftext(el, "vymera")
    items.append({"znacka": znacka, "nazev": nazev, "popis": popis,
                  "mnozstvi": mnoz, "mj": mj, "cs": cs, "vymera": vym})
res["soupis_total_polozka"] = len(items)

def to_f(s):
    try: return float((s or "").replace(" ", "").replace(",", "."))
    except: return None

# index by znacka (first 6 digits too)
by_code = {}
for it in items:
    by_code.setdefault(it["znacka"], []).append(it)

# ---- 2. Golden code match ----
for code, g in GOLDEN.items():
    hits = []
    for it in items:
        z = (it["znacka"] or "").replace(" ", "")
        if z == code or z.startswith(code):
            hits.append(it)
    row = {"code": code, "golden": g, "found_n": len(hits)}
    if hits:
        # pick the one whose mnozstvi is closest to golden objem
        best = min(hits, key=lambda h: abs((to_f(h["mnozstvi"]) or 0) - g["objem"]))
        q = to_f(best["mnozstvi"])
        row["soupis_mnozstvi"] = q
        row["soupis_mj"] = best["mj"]
        row["soupis_nazev"] = (best["nazev"] or best["popis"])[:90]
        row["delta_pct"] = round((q - g["objem"]) / g["objem"] * 100, 2) if (q and g["objem"]) else None
        cc = CC_RE.search((best["nazev"] or "") + " " + (best["popis"] or ""))
        row["concrete_class_in_name"] = ("C%s/%s" % cc.groups()) if cc else None
    res["golden_match"].append(row)

# ---- 3. All concrete items in soupis ----
for it in items:
    blob = ((it["nazev"] or "") + " " + (it["popis"] or "")).lower()
    if "beton" in blob or CC_RE.search(it["nazev"] or it["popis"] or ""):
        cc = CC_RE.search((it["nazev"] or "") + " " + (it["popis"] or ""))
        exps = EXP_RE.findall((it["nazev"] or "") + " " + (it["popis"] or ""))
        res["concrete_items_all"].append({
            "znacka": it["znacka"], "nazev": (it["nazev"] or it["popis"])[:100],
            "mnozstvi": it["mnozstvi"], "mj": it["mj"],
            "concrete_class": ("C%s/%s" % cc.groups()) if cc else None,
            "exposures": exps,
        })

# ---- 4. Concrete classes + exposures across whole soupis ----
cc_counter = {}
exp_counter = {}
for it in items:
    s = (it["nazev"] or "") + " " + (it["popis"] or "")
    for m in CC_RE.finditer(s):
        k = "C%s/%s" % m.groups(); cc_counter[k] = cc_counter.get(k, 0) + 1
    for e in EXP_RE.findall(s):
        exp_counter[e] = exp_counter.get(e, 0) + 1
res["concrete_classes_in_soupis"] = dict(sorted(cc_counter.items(), key=lambda x:-x[1]))
res["exposures_in_soupis"] = dict(sorted(exp_counter.items(), key=lambda x:-x[1]))

# ---- 5. TZ geometry presence (literal tokens in raw text) ----
import app.mcp.tools.document as docmod
tz_text = docmod._extract_pdf_text(TZ)
res["tz_total_chars"] = len(tz_text)
golden_tokens = {
    "C35/45": [r"C\s*35\s*/\s*45"],
    "XF2": [r"XF2"], "XD1": [r"XD1"], "XC4": [r"XC4"],
    "span 32.0": [r"32,0", r"32,00"], "span 44.5": [r"44,5", r"44,50"],
    "span_pattern 32+44.5+32": [r"32[,.]0\s*\+\s*44[,.]5\s*\+\s*32[,.]0"],
    "konstr. výška 2.40": [r"2,40\s*m", r"v[yý]š\w*\s+tr[aá]m\w*\s+2,40"],
    "šířka NK 13.65": [r"13,65", r"13,650"],
    "dvoutrám": [r"dvoutr[aá]m"],
    "Y1860": [r"Y\s*1860"],
    "22-lanové / 22 lan": [r"22[\s\-]*lan", r"22[\s\-]*lanov"],
    "150 mm² / PL2": [r"150\s*mm", r"\bPL2\b"],
    "pevná skruž": [r"pevn[aá]\s+skru[zž]"],
    "3 etapy": [r"t[rř][ií]\s+etap", r"3\s+etap", r"ve\s+3\s+etap"],
    "předpjat": [r"p[rř]edp[ji]at", r"p[rř]edp[ií]n"],
}
for label, pats in golden_tokens.items():
    found = any(re.search(p, tz_text, re.I) for p in pats)
    # also count occurrences of the first pattern
    cnt = len(re.findall(pats[0], tz_text, re.I))
    res["tz_geometry_presence"][label] = {"present_in_text": bool(found), "first_pat_hits": cnt}

OUT.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
print("=== CROSS-CHECK SUMMARY ===")
print("soupis polozka total:", res["soupis_total_polozka"])
print("\n-- golden code match --")
for r in res["golden_match"]:
    print(f"  {r['code']}: golden {r['golden']['objem']} m3 | soupis "
          f"{r.get('soupis_mnozstvi')} {r.get('soupis_mj','')} | Δ {r.get('delta_pct')}% "
          f"| class-in-name {r.get('concrete_class_in_name')} | n={r['found_n']}")
print("\n-- concrete classes in soupis names --", res["concrete_classes_in_soupis"])
print("-- exposures in soupis names --", res["exposures_in_soupis"])
print("-- # concrete items --", len(res["concrete_items_all"]))
print("\n-- TZ golden token presence --")
for k,v in res["tz_geometry_presence"].items():
    print(f"  {'YES' if v['present_in_text'] else 'no ':3s} {k:28s} hits={v['first_pat_hits']}")
print("\nwrote", OUT)
