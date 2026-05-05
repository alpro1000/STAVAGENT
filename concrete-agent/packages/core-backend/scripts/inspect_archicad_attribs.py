"""Phase 2 micro-step — probe INSERT attribs structure on door/window/IDEN layers."""
from __future__ import annotations

import json
from pathlib import Path

import ezdxf

DXF = Path(
    "test-data/libuse/inputs/dxf/"
    "185-01_DPS_D_SO01_140_4410_00-OBJEKT D - Půdorys 1 .NP.dxf"
)

doc = ezdxf.readfile(str(DXF))
msp = doc.modelspace()


def dump_samples(layer_name: str, label: str, sample_n: int = 3) -> None:
    inserts = [e for e in msp.query("INSERT") if e.dxf.layer == layer_name]
    print(f"\n=== {label} — layer `{layer_name}` ({len(inserts)} total) ===")
    for ins in inserts[:sample_n]:
        print()
        print(f"  Block name: {ins.dxf.name}")
        print(f"  Position: ({ins.dxf.insert.x:.1f}, {ins.dxf.insert.y:.1f})")
        try:
            has_attr = bool(ins.has_attrib)
        except AttributeError:
            has_attr = ins.attribs_follow if hasattr(ins, "attribs_follow") else False
        print(f"  Has attribs: {has_attr}")
        attribs = list(ins.attribs)
        print(f"  Attribs count: {len(attribs)}")
        for attr in attribs:
            tag = attr.dxf.tag
            text = attr.dxf.text
            print(f"    attrib tag='{tag}' text='{text}'")


for layer, label in [
    ("A-DOOR-____-OTLN", "Doors (geometry)"),
    ("A-GLAZ-____-OTLN", "Windows (geometry)"),
    ("A-GLAZ-CURT-OTLN", "Curtain walls"),
    ("A-DOOR-____-IDEN", "Door tags"),
    ("A-GLAZ-____-IDEN", "Window tags"),
    ("A-WALL-____-IDEN", "Wall tags (room/element marks)"),
]:
    dump_samples(layer, label, 3)


def unique_blocks(layer_name: str) -> list[str]:
    inserts = [e for e in msp.query("INSERT") if e.dxf.layer == layer_name]
    return sorted({e.dxf.name for e in inserts})


print("\n\n=== Unique block names per layer ===")
for layer_name in [
    "A-DOOR-____-OTLN",
    "A-DOOR-____-IDEN",
    "A-GLAZ-____-OTLN",
    "A-GLAZ-CURT-OTLN",
    "A-GLAZ-CWMG-OTLN",
]:
    inserts = [e for e in msp.query("INSERT") if e.dxf.layer == layer_name]
    block_names = sorted({e.dxf.name for e in inserts})
    print(f"\n{layer_name} ({len(inserts)} INSERTs, {len(block_names)} unique blocks):")
    for bn in block_names[:15]:
        print(f"  - {bn}")
    if len(block_names) > 15:
        print(f"  ... +{len(block_names) - 15} more")


# Also: if door/window OTLN inserts have NO attribs, scan all IDEN-layer inserts
# and dump attribs from THEM exhaustively (max 5 per layer) to learn the schema
print("\n\n=== Full attribs dump from *_IDEN inserts (first 5 per layer) ===")
for layer_name in ["A-DOOR-____-IDEN", "A-GLAZ-____-IDEN", "A-WALL-____-IDEN"]:
    inserts = [e for e in msp.query("INSERT") if e.dxf.layer == layer_name]
    print(f"\n--- {layer_name} (showing 5 of {len(inserts)}) ---")
    for ins in inserts[:5]:
        attribs = list(ins.attribs)
        attrib_dict = {a.dxf.tag: a.dxf.text for a in attribs}
        print(
            f"  block={ins.dxf.name[:60]!r:62s}  "
            f"pos=({ins.dxf.insert.x:.0f},{ins.dxf.insert.y:.0f})  "
            f"attribs={json.dumps(attrib_dict, ensure_ascii=False)}"
        )

# Check the IDEN-layer TEXT/MTEXT entities too, since some workflows put the
# type-mark text directly as TEXT/MTEXT on *_IDEN layers (not as INSERT attribs).
print("\n\n=== Sample TEXT/MTEXT contents on *_IDEN layers ===")
for layer_name in ["A-DOOR-____-IDEN", "A-GLAZ-____-IDEN", "A-WALL-____-IDEN"]:
    txts = [e for e in msp.query("TEXT MTEXT") if e.dxf.layer == layer_name]
    print(f"\n--- {layer_name} ({len(txts)} TEXT/MTEXT) ---")
    for t in txts[:10]:
        raw = t.dxf.text if t.dxftype() == "TEXT" else t.text
        raw = raw.replace("\n", "↵").replace("\r", "")
        if len(raw) > 80:
            raw = raw[:80] + "…"
        print(f"  pos=({t.dxf.insert.x:.0f},{t.dxf.insert.y:.0f})  '{raw}'")
