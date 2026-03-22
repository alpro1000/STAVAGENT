#!/usr/bin/env python3
"""
PERI PDF Prospekt/Plakat Parser — Extract technical specifications from PERI product brochures.

Downloads PDFs from GCS bucket 'stavagent-cenik-norms' (if credentials available)
or reads from local directory, parses them via pdfplumber, and generates
structured JSON for the Knowledge Base.

Usage:
    # Parse local PDFs
    python parse_peri_pdfs.py --input-dir ./

    # Download from GCS first, then parse
    python parse_peri_pdfs.py --gcs-bucket stavagent-cenik-norms --download

    # Parse only specific systems
    python parse_peri_pdfs.py --systems domino trio vario

    # Parse only prospekt files (recommended — smaller, data-dense)
    python parse_peri_pdfs.py --type prospekt

Output:
    peri_systems_parsed.json — Structured data for all parsed systems
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

# ─── Configuration ────────────────────────────────────────────────────────────

# Map PDF filenames to PERI system names
SYSTEM_MAP = {
    'domino': 'DOMINO',
    'trio': 'TRIO',
    'vario-prospekt': 'VARIO',
    'vario-navod': 'VARIO',
    'maximo-prospekt': 'MAXIMO',
    'maximo-navod': 'MAXIMO',
    'maximo-mxk': 'MAXIMO MXK',
    'maximo-plakat': 'MAXIMO',
    'duo': 'DUO',
    'skydeck': 'SKYDECK',
    'quattro': 'QUATTRO',
    'multiflex': 'MULTIFLEX',
    'rundflex': 'RUNDFLEX',
    'srs': 'SRS',
    'scs': 'SCS',
    'variokit': 'VARIOKIT',
    'prokit-ep-110': 'PROKIT EP 110',
    'trs': 'TRS',
    'rcs-lite': 'RCS LITE',
    'sky-kotva': 'Sky-kotva',
    'stabilizatory': 'Stabilizátory',
    'technika-spinani': 'Technika spínání',
    'operny-ram-sb': 'Opěrný rám SB',
    'peri-cb-240-a-cb-160': 'CB 240/160',
    'zasobovaci-plosina-rcs-mp': 'Zásobovací plošina RCS-MP',
    'vyrobni-program-bedneni': 'Výrobní program',
}

# Document types and their data density
DOC_TYPES = {
    'prospekt': {'priority': 1, 'data_density': 'high', 'desc': 'Product brochure — tech specs, dimensions, weights'},
    'plakat': {'priority': 2, 'data_density': 'medium', 'desc': 'Quick reference poster — key specs'},
    'navod': {'priority': 3, 'data_density': 'low', 'desc': 'Assembly manual — assembly norms, procedures'},
}

# Keywords for extracting technical data from Czech PDFs
SPEC_KEYWORDS = {
    'weight': [r'hmotnost[:\s]*(\d+[\.,]?\d*)\s*kg', r'(\d+[\.,]?\d*)\s*kg/m', r'váha[:\s]*(\d+[\.,]?\d*)\s*kg'],
    'height': [r'výška[:\s]*(\d+[\.,]?\d*)\s*m', r'h\s*=\s*(\d+[\.,]?\d*)\s*m', r'(\d+[\.,]?\d*)\s*mm\s*výšk'],
    'width': [r'šířka[:\s]*(\d+[\.,]?\d*)\s*mm', r'(\d+[\.,]?\d*)\s*mm\s*šířk', r'šíř[:\s]*(\d+[\.,]?\d*)\s*cm'],
    'pressure': [r'tlak\s*betonu[:\s]*(\d+[\.,]?\d*)\s*kN', r'(\d+[\.,]?\d*)\s*kN/m', r'Frischbetondruck[:\s]*(\d+[\.,]?\d*)\s*kN',
                 r'max\.\s*tlak[:\s]*(\d+[\.,]?\d*)\s*kN', r'(\d+[\.,]?\d*)\s*kN/m²'],
    'area': [r'plocha[:\s]*(\d+[\.,]?\d*)\s*m²', r'(\d+[\.,]?\d*)\s*m²/panel'],
    'assembly': [r'montáž[:\s]*(\d+[\.,]?\d*)\s*h/m²', r'(\d+[\.,]?\d*)\s*Nh/m²', r'(\d+[\.,]?\d*)\s*h/m²\s*mont'],
}


def classify_pdf(filename: str) -> tuple[str, str, str]:
    """Classify PDF by system name and document type.

    Returns (system_id, system_name, doc_type)
    """
    name_lower = filename.lower().replace('.pdf', '')

    # Determine document type
    doc_type = 'unknown'
    for dtype in ['prospekt', 'plakat', 'navod']:
        # Handle Czech diacritics: plakát → plakit, návod → navod
        if dtype in name_lower or dtype.replace('a', 'á') in name_lower:
            doc_type = dtype
            break

    # Determine system
    system_id = 'unknown'
    system_name = 'Unknown'
    for key, name in SYSTEM_MAP.items():
        if key in name_lower:
            system_id = key.split('-')[0]  # 'maximo-mxk' → 'maximo'
            system_name = name
            break

    return system_id, system_name, doc_type


def parse_czech_number(text: str) -> float:
    """Parse Czech/European number format (1.234,56 → 1234.56)."""
    text = text.strip()
    text = text.replace(' ', '')
    if ',' in text and '.' in text:
        text = text.replace('.', '').replace(',', '.')
    elif ',' in text:
        text = text.replace(',', '.')
    return float(text)


def extract_tables_from_pdf(pdf_path: str, max_pages: int = 50) -> list[dict]:
    """Extract tables from PDF using pdfplumber."""
    import pdfplumber

    tables_data = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page_count = min(len(pdf.pages), max_pages)
            for i in range(page_count):
                page = pdf.pages[i]
                tables = page.extract_tables()
                for t_idx, table in enumerate(tables):
                    if table and len(table) > 1:
                        tables_data.append({
                            'page': i + 1,
                            'table_index': t_idx,
                            'rows': table,
                            'header': table[0] if table else [],
                        })
    except Exception as e:
        print(f"  WARNING: Failed to extract tables from {pdf_path}: {e}")
    return tables_data


def extract_text_from_pdf(pdf_path: str, max_pages: int = 50) -> str:
    """Extract text from PDF using pdfplumber."""
    import pdfplumber

    text_parts = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page_count = min(len(pdf.pages), max_pages)
            for i in range(page_count):
                page_text = pdf.pages[i].extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        print(f"  WARNING: Failed to extract text from {pdf_path}: {e}")
    return '\n'.join(text_parts)


def extract_specs_from_text(text: str) -> dict:
    """Extract technical specifications using regex patterns."""
    specs = {}

    for spec_type, patterns in SPEC_KEYWORDS.items():
        values = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    val = parse_czech_number(match)
                    if val > 0:
                        values.append(val)
                except ValueError:
                    pass
        if values:
            specs[spec_type] = {
                'values': sorted(set(values)),
                'min': min(values),
                'max': max(values),
                'count': len(values),
            }

    return specs


def extract_panel_specs_from_tables(tables: list[dict]) -> list[dict]:
    """Extract panel specifications from parsed tables."""
    panels = []

    for table_info in tables:
        rows = table_info['rows']
        header = table_info.get('header', [])

        # Look for dimension/weight columns
        if not header:
            continue

        header_lower = [str(h).lower() if h else '' for h in header]

        # Check if this looks like a specs table
        has_dim = any('rozm' in h or 'šíř' in h or 'výš' in h or 'mm' in h for h in header_lower)
        has_weight = any('hmot' in h or 'kg' in h or 'váh' in h for h in header_lower)
        has_area = any('ploch' in h or 'm²' in h or 'm2' in h for h in header_lower)

        if has_dim or has_weight or has_area:
            for row in rows[1:]:  # Skip header
                panel = {
                    'page': table_info['page'],
                    'raw_row': [str(c) if c else '' for c in row],
                }
                # Try to extract known columns
                for j, cell in enumerate(row):
                    if cell is None:
                        continue
                    cell_str = str(cell).strip()
                    col_name = header_lower[j] if j < len(header_lower) else ''

                    if 'hmot' in col_name or 'kg' in col_name:
                        try:
                            panel['weight_kg'] = parse_czech_number(cell_str.replace('kg', '').strip())
                        except ValueError:
                            pass
                    elif 'ploch' in col_name or 'm²' in col_name:
                        try:
                            panel['area_m2'] = parse_czech_number(cell_str.replace('m²', '').strip())
                        except ValueError:
                            pass
                    elif 'rozm' in col_name or 'šíř' in col_name:
                        panel['dimensions'] = cell_str
                    elif 'výš' in col_name:
                        panel['height'] = cell_str
                    elif 'ozn' in col_name or 'typ' in col_name or 'art' in col_name:
                        panel['article'] = cell_str

                if len(panel) > 2:  # Has more than just page and raw_row
                    panels.append(panel)

    return panels


def parse_single_pdf(pdf_path: str) -> dict:
    """Parse a single PERI PDF and extract structured data."""
    filename = os.path.basename(pdf_path)
    file_size_mb = os.path.getsize(pdf_path) / (1024 * 1024)

    system_id, system_name, doc_type = classify_pdf(filename)

    print(f"  Parsing: {filename} ({file_size_mb:.1f} MB) → {system_name} [{doc_type}]")

    # Skip very large files (>50 MB) — they're usually manuals with images
    if file_size_mb > 50 and doc_type == 'navod':
        print(f"    SKIPPING: Too large for návod ({file_size_mb:.0f} MB). Use prospekt instead.")
        return {
            'filename': filename,
            'system_id': system_id,
            'system_name': system_name,
            'doc_type': doc_type,
            'file_size_mb': round(file_size_mb, 1),
            'status': 'skipped_too_large',
        }

    # Extract text and tables
    text = extract_text_from_pdf(pdf_path)
    tables = extract_tables_from_pdf(pdf_path)

    # Extract specs from text
    specs = extract_specs_from_text(text)

    # Extract panel specs from tables
    panels = extract_panel_specs_from_tables(tables)

    # Extract text snippet (first 500 chars for context)
    text_preview = text[:500] if text else ''

    return {
        'filename': filename,
        'system_id': system_id,
        'system_name': system_name,
        'doc_type': doc_type,
        'file_size_mb': round(file_size_mb, 1),
        'status': 'parsed',
        'text_length': len(text),
        'tables_found': len(tables),
        'specs': specs,
        'panels': panels[:20],  # Limit to 20 panels
        'text_preview': text_preview,
    }


def merge_system_data(parsed_files: list[dict]) -> dict:
    """Merge data from multiple PDFs for the same system."""
    systems = {}

    for pf in parsed_files:
        if pf.get('status') != 'parsed':
            continue

        sys_name = pf['system_name']
        if sys_name not in systems:
            systems[sys_name] = {
                'name': sys_name,
                'manufacturer': 'PERI',
                'sources': [],
                'specs': {},
                'panels': [],
                'text_previews': [],
            }

        sys = systems[sys_name]
        sys['sources'].append({
            'filename': pf['filename'],
            'doc_type': pf['doc_type'],
            'tables_found': pf['tables_found'],
            'text_length': pf['text_length'],
        })

        # Merge specs (take max ranges)
        for spec_type, spec_data in pf.get('specs', {}).items():
            if spec_type not in sys['specs']:
                sys['specs'][spec_type] = spec_data
            else:
                existing = sys['specs'][spec_type]
                all_values = list(set(existing['values'] + spec_data['values']))
                sys['specs'][spec_type] = {
                    'values': sorted(all_values),
                    'min': min(all_values),
                    'max': max(all_values),
                    'count': len(all_values),
                }

        # Merge panels (deduplicate by article number)
        existing_articles = {p.get('article', '') for p in sys['panels']}
        for panel in pf.get('panels', []):
            if panel.get('article', '') not in existing_articles:
                sys['panels'].append(panel)
                existing_articles.add(panel.get('article', ''))

        if pf.get('text_preview'):
            sys['text_previews'].append(pf['text_preview'][:200])

    return systems


def download_from_gcs(bucket_name: str, output_dir: str, file_filter: Optional[str] = None) -> list[str]:
    """Download PDFs from GCS bucket."""
    from google.cloud import storage

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blobs = list(bucket.list_blobs())

    downloaded = []
    for blob in blobs:
        if not blob.name.endswith('.pdf'):
            continue
        if file_filter and file_filter not in blob.name.lower():
            continue

        local_path = os.path.join(output_dir, blob.name)
        if os.path.exists(local_path) and os.path.getsize(local_path) == blob.size:
            print(f"  Already downloaded: {blob.name}")
            downloaded.append(local_path)
            continue

        print(f"  Downloading: {blob.name} ({blob.size / (1024*1024):.1f} MB)")
        blob.download_to_filename(local_path)
        downloaded.append(local_path)

    return downloaded


def main():
    parser = argparse.ArgumentParser(description='Parse PERI formwork PDF brochures')
    parser.add_argument('--input-dir', default='.', help='Directory with PDF files')
    parser.add_argument('--gcs-bucket', default='stavagent-cenik-norms', help='GCS bucket name')
    parser.add_argument('--download', action='store_true', help='Download from GCS first')
    parser.add_argument('--systems', nargs='+', help='Only parse specific systems')
    parser.add_argument('--type', choices=['prospekt', 'plakat', 'navod'], help='Only parse specific doc type')
    parser.add_argument('--output', default='peri_systems_parsed.json', help='Output JSON file')
    parser.add_argument('--max-size-mb', type=float, default=50.0, help='Skip files larger than this')
    args = parser.parse_args()

    input_dir = args.input_dir

    # Download from GCS if requested
    if args.download:
        print(f"Downloading PDFs from gs://{args.gcs_bucket}/...")
        downloaded = download_from_gcs(args.gcs_bucket, input_dir, args.type)
        print(f"Downloaded {len(downloaded)} files.")

    # Find PDF files
    pdf_files = sorted(Path(input_dir).glob('*.pdf'))
    if not pdf_files:
        print(f"No PDF files found in {input_dir}")
        print("Please download PERI PDFs from GCS bucket 'stavagent-cenik-norms' first:")
        print("  gsutil -m cp 'gs://stavagent-cenik-norms/*-prospekt.pdf' .")
        print("  gsutil -m cp 'gs://stavagent-cenik-norms/*-plakat.pdf' .")
        print("  gsutil -m cp 'gs://stavagent-cenik-norms/*-navod.pdf' .")
        sys.exit(1)

    # Filter by system if specified
    if args.systems:
        pdf_files = [f for f in pdf_files if any(s.lower() in f.name.lower() for s in args.systems)]

    # Filter by type if specified
    if args.type:
        pdf_files = [f for f in pdf_files if args.type in f.name.lower()]

    # Filter by size
    pdf_files = [f for f in pdf_files if f.stat().st_size / (1024*1024) <= args.max_size_mb]

    print(f"\nFound {len(pdf_files)} PDF files to parse:")
    for f in pdf_files:
        mb = f.stat().st_size / (1024*1024)
        print(f"  {f.name} ({mb:.1f} MB)")

    # Parse all PDFs
    print(f"\n{'='*60}")
    print("PARSING")
    print(f"{'='*60}")

    parsed_files = []
    for pdf_file in pdf_files:
        try:
            result = parse_single_pdf(str(pdf_file))
            parsed_files.append(result)
        except Exception as e:
            print(f"  ERROR parsing {pdf_file.name}: {e}")
            parsed_files.append({
                'filename': pdf_file.name,
                'status': 'error',
                'error': str(e),
            })

    # Merge by system
    print(f"\n{'='*60}")
    print("MERGING SYSTEM DATA")
    print(f"{'='*60}")

    systems = merge_system_data(parsed_files)
    for name, data in systems.items():
        print(f"  {name}: {len(data['sources'])} sources, {len(data['panels'])} panels, {len(data['specs'])} spec types")

    # Generate output
    output = {
        '_meta': {
            'generated_by': 'parse_peri_pdfs.py',
            'source': 'PERI product brochures (prospekty, plakáty, návody)',
            'files_parsed': len(parsed_files),
            'systems_found': len(systems),
        },
        'parsed_files': parsed_files,
        'systems': systems,
    }

    output_path = os.path.join(input_dir, args.output)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"OUTPUT: {output_path}")
    print(f"Systems: {', '.join(systems.keys())}")
    print(f"Files parsed: {len([f for f in parsed_files if f.get('status') == 'parsed'])}")
    print(f"Files skipped: {len([f for f in parsed_files if f.get('status') != 'parsed'])}")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
