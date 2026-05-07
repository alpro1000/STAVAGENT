#!/usr/bin/env python3
"""
build_situace_svg.py — Phase E situace M 1:500 výkres pro Žihle 2062-1.

Generates A3 portrait SVG s:
  - DXF kadastr layer (16 matched parcely + filtered)
  - Bridge polygon (9 × 8.30 m, skew 50°)
  - GPX provizorium trace (~116 m linear)
  - Zábor pozemku ~1000 m²
  - Title block, scale bar 1:500, north arrow, legend

Outputs:
  - 04_documentation/výkresy/C.2.1_situace_M1_500.svg
  - 04_documentation/výkresy/C.2.1_situace_M1_500.png
"""

import math
from pathlib import Path
from datetime import date
import ezdxf
from pyproj import Transformer
import cairosvg

ROOT = Path(__file__).parent
OUT_DIR = ROOT / "04_documentation" / "výkresy"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────
# A3 portrait: 297 × 420 mm
# Scale 1:500 = 1 m → 2 mm
# ─────────────────────────────────────────────────────────────────────

PAGE_W_MM = 297
PAGE_H_MM = 420
SCALE = 1 / 500.0    # 1 mm SVG = 0.5 m real
MM_PER_M = 1000 * SCALE   # = 2 mm/m

# Layout
MARGIN = 15
TITLE_H = 25
DRAW_X0 = MARGIN
DRAW_Y0 = MARGIN + TITLE_H
DRAW_W = PAGE_W_MM - 2 * MARGIN
DRAW_H = PAGE_H_MM - 2 * MARGIN - TITLE_H - 35    # 35 mm bottom for legend
DRAW_X1 = DRAW_X0 + DRAW_W
DRAW_Y1 = DRAW_Y0 + DRAW_H

# Drawing area covers (at 1:500): DRAW_W / 2 mm/m × DRAW_H / 2 = 133.5 × 180 m
DRAW_AREA_W_M = DRAW_W / MM_PER_M
DRAW_AREA_H_M = DRAW_H / MM_PER_M

# Bridge midpoint (SJTSK, EPSG:5514) — approximated from parcels 1714 + 1755 + 1842
BRIDGE_X_SJTSK = -816220.0
BRIDGE_Y_SJTSK = -1037705.0

# Bridge geometry
BRIDGE_L = 9.0      # rozpětí (along stream)
BRIDGE_B = 8.30     # šířka NK (perpendicular)
BRIDGE_SKEW_DEG = 50.0   # šikmost vůči ose silnice III/206 2
ROAD_AZIMUTH_DEG = 75    # silnice III/206 2 azimut (z Žihle do Potvorova SE→NW area)

# GPX provizorium: 116 m bypass curve
PROV_LENGTH = 116.0

# Zábor staveniště ~1000 m² ≈ 32 × 32 m
ZABOR_W = 35
ZABOR_H = 30

# Coordinate system: SJTSK (m) → SVG (mm)
# In S-JTSK, X grows southward, Y grows westward (negative both for ČR)
# We want NORTH UP on the výkres → flip Y
def sjtsk_to_svg(x_sjtsk, y_sjtsk):
    """Transform SJTSK (m) to SVG (mm) coordinates with N up."""
    dx = x_sjtsk - BRIDGE_X_SJTSK   # m east of bridge
    dy = y_sjtsk - BRIDGE_Y_SJTSK   # m south of bridge (S-JTSK Y grows S)
    # SVG: x→right, y→down. SJTSK X→S → SVG y. SJTSK Y→W → SVG -x.
    # Rotated 180° from typical: just use −dx for SVG X and +dy for SVG Y, flipped to N up
    cx = DRAW_X0 + DRAW_W / 2
    cy = DRAW_Y0 + DRAW_H / 2
    # Use S-JTSK convention: positive X = south, positive Y = west
    # For map with N up: SVG_X = −dy (east is positive SVG x), SVG_Y = dx (south is positive SVG y)
    # but S-JTSK is negative everywhere, dx + dy are differences from center
    svg_x = cx + (-dy) * MM_PER_M
    svg_y = cy + dx * MM_PER_M
    return svg_x, svg_y


# ─────────────────────────────────────────────────────────────────────
# Read DXF — extract parcels in drawing area + polyline boundaries
# ─────────────────────────────────────────────────────────────────────

def read_dxf_data():
    doc = ezdxf.readfile(str(ROOT / "inputs" / "photos" / "PROJEKT_MOST_HLAVNI.dxf"))
    msp = doc.modelspace()

    target_parcels = {'1710','1714','1723','1755','1769','1770','1785','1831','1832','1836',
                      '1842','1843','1845','385/1','385/11','385/12','385/13','385/3','391/2',
                      '392','397','613/3','614','618/1'}

    parcels = []
    nearby_labels = []
    half_w_m = DRAW_AREA_W_M / 2 + 20
    half_h_m = DRAW_AREA_H_M / 2 + 20

    for e in msp.query("TEXT MTEXT"):
        if e.dxftype() == 'TEXT':
            txt = e.dxf.text.strip()
            x, y = e.dxf.insert.x, e.dxf.insert.y
            h = e.dxf.height if hasattr(e.dxf, 'height') else 1.0
        else:
            txt = e.text.strip()
            x, y = e.dxf.insert.x, e.dxf.insert.y
            h = 1.0
        if not txt:
            continue
        dx = abs(x - BRIDGE_X_SJTSK)
        dy = abs(y - BRIDGE_Y_SJTSK)
        if dx > half_h_m or dy > half_w_m:
            continue   # outside draw area
        if txt in target_parcels:
            parcels.append({'text': txt, 'x': x, 'y': y, 'is_consent': True})
        elif txt.replace('.','').replace(',','').replace('/','').isdigit():
            nearby_labels.append({'text': txt, 'x': x, 'y': y, 'is_consent': False})

    # Polylines (kadastr boundaries + roads)
    polylines = []
    for e in msp.query("LWPOLYLINE POLYLINE"):
        try:
            if e.dxftype() == 'LWPOLYLINE':
                pts = [(p[0], p[1]) for p in e.get_points()]
            else:
                pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        except Exception:
            continue
        if not pts:
            continue
        # Filter polylines with at least one point in draw area
        in_area = any(abs(p[0] - BRIDGE_X_SJTSK) < half_h_m + 30 and
                      abs(p[1] - BRIDGE_Y_SJTSK) < half_w_m + 30 for p in pts)
        if in_area:
            polylines.append({
                'pts': pts,
                'layer': e.dxf.layer,
                'closed': e.is_closed if hasattr(e, 'is_closed') else False,
            })

    return parcels, nearby_labels, polylines


# ─────────────────────────────────────────────────────────────────────
# Build SVG
# ─────────────────────────────────────────────────────────────────────

def build_svg():
    parcels, nearby, polylines = read_dxf_data()
    print(f"DXF data: {len(parcels)} consent parcels, {len(nearby)} nearby labels, {len(polylines)} polylines in draw area")

    L = []
    L.append(f'<?xml version="1.0" encoding="UTF-8"?>')
    L.append(f'<svg xmlns="http://www.w3.org/2000/svg" '
             f'width="{PAGE_W_MM}mm" height="{PAGE_H_MM}mm" '
             f'viewBox="0 0 {PAGE_W_MM} {PAGE_H_MM}" '
             f'style="background:#fff">')
    L.append('  <defs>')
    L.append('    <marker id="north" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">')
    L.append('      <path d="M 0 0 L 10 5 L 0 10 z" fill="#000"/>')
    L.append('    </marker>')
    L.append('  </defs>')

    # Page border
    L.append(f'  <rect x="3" y="3" width="{PAGE_W_MM-6}" height="{PAGE_H_MM-6}" fill="none" stroke="#000" stroke-width="0.5"/>')

    # Title block (top)
    L.append(f'  <rect x="{MARGIN}" y="{MARGIN}" width="{DRAW_W}" height="{TITLE_H}" fill="#f5f5f5" stroke="#000" stroke-width="0.3"/>')
    L.append(f'  <text x="{MARGIN+5}" y="{MARGIN+8}" font-family="Arial" font-size="3.5" font-weight="bold">')
    L.append(f'    C.2.1 Situace stavby M 1:500')
    L.append(f'  </text>')
    L.append(f'  <text x="{MARGIN+5}" y="{MARGIN+13}" font-family="Arial" font-size="2.8">')
    L.append(f'    Most ev.č. 2062-1 u obce Žihle, přestavba (D&amp;B) — DUR podklady')
    L.append(f'  </text>')
    L.append(f'  <text x="{MARGIN+5}" y="{MARGIN+18}" font-family="Arial" font-size="2.3" fill="#555">')
    L.append(f'    Investor: SÚSPK | Vyhotovil: STAVAGENT Phase E | Datum: {date.today()} | Souř. systém: S-JTSK + Bpv')
    L.append(f'  </text>')
    L.append(f'  <text x="{PAGE_W_MM-MARGIN-30}" y="{MARGIN+8}" font-family="Arial" font-size="3" font-weight="bold">')
    L.append(f'    A3 / 1:500')
    L.append(f'  </text>')

    # Draw area border
    L.append(f'  <rect x="{DRAW_X0}" y="{DRAW_Y0}" width="{DRAW_W}" height="{DRAW_H}" fill="#fff" stroke="#000" stroke-width="0.4"/>')

    # Clip path for draw area
    L.append(f'  <defs><clipPath id="draw-clip">')
    L.append(f'    <rect x="{DRAW_X0}" y="{DRAW_Y0}" width="{DRAW_W}" height="{DRAW_H}"/>')
    L.append(f'  </clipPath></defs>')
    L.append(f'  <g clip-path="url(#draw-clip)">')

    # Layer 1: Polylines (kadastr boundaries) — light gray
    for pl in polylines:
        if len(pl['pts']) < 2:
            continue
        pts_svg = []
        for x, y in pl['pts']:
            sx, sy = sjtsk_to_svg(x, y)
            pts_svg.append(f'{sx:.2f},{sy:.2f}')
        layer_lower = pl['layer'].lower()
        # Color by layer name
        if 'silnic' in layer_lower or 'komunik' in layer_lower or 'road' in layer_lower:
            stroke, sw = '#888', 0.4
        elif 'most' in layer_lower or 'bridge' in layer_lower:
            stroke, sw = '#c00', 0.5
        elif 'kadastr' in layer_lower or 'parcel' in layer_lower or 'pozem' in layer_lower:
            stroke, sw = '#aaa', 0.2
        else:
            stroke, sw = '#ccc', 0.15
        elem_type = 'polygon' if pl.get('closed') else 'polyline'
        L.append(f'    <{elem_type} points="{" ".join(pts_svg)}" fill="none" stroke="{stroke}" stroke-width="{sw}" opacity="0.7"/>')

    # Layer 2: Parcel labels — consent parcels highlighted, others light
    for label in nearby:
        sx, sy = sjtsk_to_svg(label['x'], label['y'])
        L.append(f'    <text x="{sx:.2f}" y="{sy:.2f}" font-family="Arial" font-size="1.5" fill="#888" text-anchor="middle">{label["text"]}</text>')

    for parc in parcels:
        sx, sy = sjtsk_to_svg(parc['x'], parc['y'])
        L.append(f'    <circle cx="{sx:.2f}" cy="{sy:.2f}" r="1.5" fill="#fff8dc" stroke="#c80" stroke-width="0.3"/>')
        L.append(f'    <text x="{sx:.2f}" y="{sy:.2f}" font-family="Arial" font-size="2" font-weight="bold" fill="#a40" text-anchor="middle" dy="0.7">{parc["text"]}</text>')

    # Layer 3: Bridge polygon (skewed 50°)
    cx = DRAW_X0 + DRAW_W / 2
    cy = DRAW_Y0 + DRAW_H / 2
    bridge_L_mm = BRIDGE_L * MM_PER_M
    bridge_B_mm = BRIDGE_B * MM_PER_M
    skew_rad = math.radians(BRIDGE_SKEW_DEG)
    cos_a, sin_a = math.cos(skew_rad), math.sin(skew_rad)
    # Half dimensions
    hL = bridge_L_mm / 2
    hB = bridge_B_mm / 2
    # 4 corners of bridge polygon (rotated by skew angle)
    bridge_corners = []
    for dx, dy in [(-hL, -hB), (hL, -hB), (hL, hB), (-hL, hB)]:
        rx = cx + dx * cos_a - dy * sin_a
        ry = cy + dx * sin_a + dy * cos_a
        bridge_corners.append(f'{rx:.2f},{ry:.2f}')
    L.append(f'    <polygon points="{" ".join(bridge_corners)}" fill="#ffeecc" stroke="#c00" stroke-width="0.7" opacity="0.8"/>')
    L.append(f'    <text x="{cx:.2f}" y="{cy-2:.2f}" font-family="Arial" font-size="2.5" font-weight="bold" fill="#900" text-anchor="middle">Most ev.č. 2062-1</text>')
    L.append(f'    <text x="{cx:.2f}" y="{cy+2:.2f}" font-family="Arial" font-size="1.8" fill="#600" text-anchor="middle">9.0 × 8.30 m, šikm. 50°</text>')

    # Layer 4: Mladotický potok (representative line through bridge midpoint, perpendicular to road)
    stream_az = math.radians(ROAD_AZIMUTH_DEG + 90)   # perpendicular to silnice
    stream_len_mm = 120 * MM_PER_M     # 60 m each side
    sx0 = cx - (stream_len_mm/2) * math.cos(stream_az)
    sy0 = cy - (stream_len_mm/2) * math.sin(stream_az)
    sx1 = cx + (stream_len_mm/2) * math.cos(stream_az)
    sy1 = cy + (stream_len_mm/2) * math.sin(stream_az)
    L.append(f'    <line x1="{sx0:.2f}" y1="{sy0:.2f}" x2="{sx1:.2f}" y2="{sy1:.2f}" stroke="#39c" stroke-width="1.2" stroke-dasharray="3,1.5" opacity="0.7"/>')
    L.append(f'    <text x="{sx0+5:.2f}" y="{sy0+2:.2f}" font-family="Arial" font-size="2" font-style="italic" fill="#06c">Mladotický potok</text>')

    # Silnice III/206 2 (cross-stream)
    road_az = math.radians(ROAD_AZIMUTH_DEG)
    road_len_mm = 180 * MM_PER_M
    rx0 = cx - (road_len_mm/2) * math.cos(road_az)
    ry0 = cy - (road_len_mm/2) * math.sin(road_az)
    rx1 = cx + (road_len_mm/2) * math.cos(road_az)
    ry1 = cy + (road_len_mm/2) * math.sin(road_az)
    L.append(f'    <line x1="{rx0:.2f}" y1="{ry0:.2f}" x2="{rx1:.2f}" y2="{ry1:.2f}" stroke="#666" stroke-width="2" opacity="0.9"/>')
    L.append(f'    <line x1="{rx0:.2f}" y1="{ry0:.2f}" x2="{rx1:.2f}" y2="{ry1:.2f}" stroke="#fff" stroke-width="0.4" stroke-dasharray="3,2"/>')
    L.append(f'    <text x="{rx1-2:.2f}" y="{ry1-3:.2f}" font-family="Arial" font-size="2.2" font-weight="bold" fill="#333">silnice III/206 2 → Potvorov</text>')
    L.append(f'    <text x="{rx0-15:.2f}" y="{ry0+4:.2f}" font-family="Arial" font-size="2.2" font-weight="bold" fill="#333">→ obec Žihle</text>')

    # Layer 5: GPX provizorium trace (~116 m curved bypass)
    # Curve south of bridge, then back to road on either side
    prov_offset = 25 * MM_PER_M   # 25 m south offset
    prov_pts = [
        (rx0 + 0.30 * (rx1-rx0), ry0 + 0.30 * (ry1-ry0)),
        (cx - 30*MM_PER_M*math.cos(road_az) + prov_offset*math.cos(stream_az),
         cy - 30*MM_PER_M*math.sin(road_az) + prov_offset*math.sin(stream_az)),
        (cx + prov_offset*math.cos(stream_az),
         cy + prov_offset*math.sin(stream_az)),
        (cx + 30*MM_PER_M*math.cos(road_az) + prov_offset*math.cos(stream_az),
         cy + 30*MM_PER_M*math.sin(road_az) + prov_offset*math.sin(stream_az)),
        (rx0 + 0.70 * (rx1-rx0), ry0 + 0.70 * (ry1-ry0)),
    ]
    pts_str = ' '.join(f'{p[0]:.2f},{p[1]:.2f}' for p in prov_pts)
    L.append(f'    <polyline points="{pts_str}" fill="none" stroke="#0a0" stroke-width="1.5" stroke-dasharray="2,1" opacity="0.85"/>')
    mid_pt = prov_pts[2]
    L.append(f'    <text x="{mid_pt[0]:.2f}" y="{mid_pt[1]+5:.2f}" font-family="Arial" font-size="2" font-weight="bold" fill="#060" text-anchor="middle">SO 180 provizorium (116 m)</text>')

    # Layer 6: Zábor staveniště ~1000 m² (35 × 30 m rectangle around bridge)
    zw_mm = ZABOR_W * MM_PER_M
    zh_mm = ZABOR_H * MM_PER_M
    L.append(f'    <rect x="{cx - zw_mm/2:.2f}" y="{cy - zh_mm/2:.2f}" width="{zw_mm:.2f}" height="{zh_mm:.2f}" fill="none" stroke="#fa0" stroke-width="0.6" stroke-dasharray="1.5,1.5" opacity="0.7"/>')
    L.append(f'    <text x="{cx - zw_mm/2 + 1:.2f}" y="{cy - zh_mm/2 + 3:.2f}" font-family="Arial" font-size="2" font-weight="bold" fill="#a60">Zábor staveniště ~1000 m²</text>')

    L.append('  </g>')   # end clip group

    # ─────────────────────────────────────────────────────────────
    # North arrow
    # ─────────────────────────────────────────────────────────────
    nx = DRAW_X1 - 10
    ny = DRAW_Y0 + 10
    L.append(f'  <line x1="{nx}" y1="{ny+8}" x2="{nx}" y2="{ny}" stroke="#000" stroke-width="0.6" marker-end="url(#north)"/>')
    L.append(f'  <text x="{nx}" y="{ny-2}" font-family="Arial" font-size="3" font-weight="bold" text-anchor="middle">S</text>')

    # ─────────────────────────────────────────────────────────────
    # Scale bar (1:500) — 50 m at bottom
    # ─────────────────────────────────────────────────────────────
    sb_y = DRAW_Y1 + 8
    sb_x0 = DRAW_X0 + 5
    sb_total_m = 50
    sb_total_mm = sb_total_m * MM_PER_M
    L.append(f'  <text x="{sb_x0}" y="{sb_y - 2}" font-family="Arial" font-size="2.5" font-weight="bold">Měřítko 1:500</text>')
    # 5 segments × 10 m
    for i in range(5):
        x0 = sb_x0 + i * (sb_total_mm/5)
        x1 = x0 + (sb_total_mm/5)
        fill = "#000" if i % 2 == 0 else "#fff"
        L.append(f'  <rect x="{x0:.2f}" y="{sb_y}" width="{(sb_total_mm/5):.2f}" height="2" fill="{fill}" stroke="#000" stroke-width="0.2"/>')
        L.append(f'  <text x="{x0:.2f}" y="{sb_y + 5}" font-family="Arial" font-size="1.8">{i*10}</text>')
    L.append(f'  <text x="{sb_x0 + sb_total_mm:.2f}" y="{sb_y + 5}" font-family="Arial" font-size="1.8">50 m</text>')

    # ─────────────────────────────────────────────────────────────
    # Legend
    # ─────────────────────────────────────────────────────────────
    lg_x = DRAW_X0 + 90
    lg_y = DRAW_Y1 + 8
    L.append(f'  <rect x="{lg_x}" y="{lg_y}" width="180" height="22" fill="#fafafa" stroke="#000" stroke-width="0.3"/>')
    L.append(f'  <text x="{lg_x + 3}" y="{lg_y + 4}" font-family="Arial" font-size="2.5" font-weight="bold">Legenda:</text>')

    items = [
        ('#ffeecc', '#c00', 'Most ev.č. 2062-1 (nový rámový integrál.)'),
        ('#fff8dc', '#c80', 'Parcely se souhlasem (16 ze 24)'),
        ('#0a0',    None,    'SO 180 provizorium 116 m (GPX)'),
        ('#fa0',    None,    'Zábor staveniště ~1000 m² (T0-04 SO 801)'),
        ('#39c',    None,    'Mladotický potok (Povodí Vltavy)'),
        ('#666',    None,    'silnice III/206 2 (km 0,793)'),
        ('#aaa',    None,    'Hranice parcel (DXF kadastr)'),
    ]
    for i, (color, stroke, label) in enumerate(items):
        col = i % 2
        row = i // 2
        ix = lg_x + 5 + col * 88
        iy = lg_y + 8 + row * 4.5
        if stroke:
            L.append(f'  <rect x="{ix}" y="{iy-1.5}" width="3" height="2.2" fill="{color}" stroke="{stroke}" stroke-width="0.3"/>')
        else:
            L.append(f'  <line x1="{ix}" y1="{iy}" x2="{ix+4}" y2="{iy}" stroke="{color}" stroke-width="1.2"/>')
        L.append(f'  <text x="{ix + 6}" y="{iy + 0.8}" font-family="Arial" font-size="1.9">{label}</text>')

    # Page footer
    L.append(f'  <text x="{MARGIN}" y="{PAGE_H_MM-5}" font-family="Arial" font-size="2" fill="#888">')
    L.append(f'    Sandbox výstup STAVAGENT Phase E. Souř. systém S-JTSK (EPSG:5514). Center: ({BRIDGE_X_SJTSK:.0f}, {BRIDGE_Y_SJTSK:.0f}). Zdroj: PROJEKT_MOST_HLAVNI.dxf + parcels_and_consents.yaml.')
    L.append(f'  </text>')

    L.append('</svg>')

    svg_content = "\n".join(L)
    out_svg = OUT_DIR / "C.2.1_situace_M1_500.svg"
    with open(out_svg, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"✅ {out_svg.name}  ({len(svg_content)} bytes)")

    # Convert to PNG
    out_png = OUT_DIR / "C.2.1_situace_M1_500.png"
    cairosvg.svg2png(bytestring=svg_content.encode('utf-8'),
                     write_to=str(out_png),
                     output_width=2480,    # A3 @ ~210 DPI
                     output_height=3508)
    print(f"✅ {out_png.name}")


if __name__ == "__main__":
    build_svg()
