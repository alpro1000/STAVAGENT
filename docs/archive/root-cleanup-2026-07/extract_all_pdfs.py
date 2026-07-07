#!/usr/bin/env python3
"""
Enhanced PDF Data Extractor for STAVAGENT Knowledge Base
Processes TKP documents and B3 price offers
"""

import os
import json
import PyPDF2
import pdfplumber
from pathlib import Path
import re
from datetime import datetime

def extract_pdf_text(pdf_path):
    """Extract text from PDF using multiple methods"""
    text_content = ""
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
                except Exception:
                    continue
    except Exception:
        pass
    
    if not text_content.strip():
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    try:
                        text_content += page.extract_text() + "\n"
                    except Exception:
                        continue
        except Exception:
            pass
    
    return text_content

def parse_tkp_document(text, filename):
    """Parse TKP technical document"""
    data = {
        "type": "tkp_document",
        "filename": filename,
        "extracted_at": datetime.now().isoformat(),
        "document_info": {},
        "technical_specs": [],
        "prices": [],
        "raw_text": text
    }
    
    # Extract TKP number and date
    tkp_match = re.search(r'TKP(\d+[AB]?)_(\d{4})_(\d{2})', filename)
    if tkp_match:
        data["document_info"]["tkp_number"] = tkp_match.group(1)
        data["document_info"]["year"] = tkp_match.group(2)
        data["document_info"]["month"] = tkp_match.group(3)
    
    # Extract prices
    price_patterns = [
        r'(\d+[\s,]\d+)\s*Kč',
        r'(\d+)\s*CZK',
        r'(\d+[\s,]\d+)\s*€',
        r'(\d+[\.,]\d+)\s*Kč'
    ]
    
    for pattern in price_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            data["prices"].append({
                "value": match,
                "context": "extracted_from_text"
            })
    
    # Extract technical specifications
    spec_patterns = [
        r'(\d+)\s*mm',
        r'(\d+)\s*m[²³]?',
        r'(\d+)\s*kg',
        r'(\d+)\s*t\b'
    ]
    
    for pattern in spec_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            data["technical_specs"].append({
                "value": match,
                "unit": pattern.split('\\s*')[1].replace('\\b', ''),
                "context": "extracted_from_text"
            })
    
    return data

def parse_bridge_project(text, filename):
    """Parse bridge project data"""
    data = {
        "type": "bridge_project",
        "filename": filename,
        "extracted_at": datetime.now().isoformat(),
        "project_info": {},
        "items": [],
        "raw_text": text
    }
    
    if "SO" in filename:
        so_match = re.search(r'SO (\d+)', filename)
        if so_match:
            data["project_info"]["so_number"] = so_match.group(1)
    
    if "km" in filename:
        km_match = re.search(r'km ([\d,]+)', filename)
        if km_match:
            data["project_info"]["km_position"] = km_match.group(1)
    
    price_patterns = [
        r'(\d+[\s,]\d+)\s*Kč',
        r'(\d+)\s*CZK',
        r'(\d+[\s,]\d+)\s*€'
    ]
    
    for pattern in price_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            data["items"].append({
                "price": match,
                "context": "extracted_from_text"
            })
    
    return data

def parse_doka_offer(text, filename):
    """Parse DOKA offer data"""
    data = {
        "type": "doka_offer",
        "filename": filename,
        "extracted_at": datetime.now().isoformat(),
        "offer_info": {},
        "items": [],
        "raw_text": text
    }
    
    offer_match = re.search(r'(\d{3}-\d{6})', filename)
    if offer_match:
        data["offer_info"]["offer_number"] = offer_match.group(1)
    
    return data

def process_all_pdfs():
    """Process all PDF files in project"""
    base_dir = Path(__file__).parent
    
    # Define search paths
    search_paths = [
        base_dir / "concrete-agent" / "packages" / "core-backend" / "app" / "knowledge_base" / "B3_current_prices",
        base_dir  # Root for TKP files
    ]
    
    all_extractions = []
    
    for search_path in search_paths:
        if not search_path.exists():
            print(f"Path does not exist: {search_path}")
            continue
            
        pdf_files = list(search_path.glob("*.pdf"))
        print(f"Found {len(pdf_files)} PDF files in {search_path}")
        
        for pdf_file in pdf_files:
            print(f"Processing: {pdf_file.name}")
            
            try:
                text = extract_pdf_text(pdf_file)
                
                if not text.strip():
                    print(f"No text extracted from {pdf_file.name}")
                    continue
                
                # Determine file type and parse accordingly
                if pdf_file.name.startswith("TKP"):
                    data = parse_tkp_document(text, pdf_file.name)
                elif "DOKA" in pdf_file.name.upper() or "540-044877" in pdf_file.name:
                    data = parse_doka_offer(text, pdf_file.name)
                else:
                    data = parse_bridge_project(text, pdf_file.name)
                
                all_extractions.append(data)
                
                # Save individual file data
                output_dir = search_path / "extracted_data"
                output_dir.mkdir(exist_ok=True)
                
                output_file = output_dir / f"{pdf_file.stem}_extracted.json"
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                # Save raw text
                txt_file = output_dir / f"{pdf_file.stem}_raw_text.txt"
                with open(txt_file, 'w', encoding='utf-8') as f:
                    f.write(text)
                
                print(f"[OK] Extracted: {pdf_file.name}")
                
            except Exception as e:
                print(f"[ERROR] Error processing {pdf_file.name}: {e}")
    
    # Save combined data
    knowledge_base_dir = base_dir / "concrete-agent" / "packages" / "core-backend" / "app" / "knowledge_base"
    knowledge_base_dir.mkdir(parents=True, exist_ok=True)
    
    combined_file = knowledge_base_dir / "all_pdf_knowledge.json"
    with open(combined_file, 'w', encoding='utf-8') as f:
        json.dump(all_extractions, f, ensure_ascii=False, indent=2)
    
    print(f"\n[DONE] Processed {len(all_extractions)} PDF files")
    print(f"[INFO] Combined knowledge saved to: {combined_file}")
    
    return len(all_extractions)

if __name__ == "__main__":
    count = process_all_pdfs()