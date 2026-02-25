#!/usr/bin/env python3
"""
PDF Data Extractor for B3 Current Prices
Extracts structured data from PDF files and saves as JSON/TXT
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
    
    # Method 1: pdfplumber (better for tables)
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
                except Exception as page_error:
                    print(f"Warning: Page extraction failed: {page_error}")
                    continue
    except Exception as e:
        print(f"pdfplumber failed for {pdf_path}: {e}")
    
    # Method 2: PyPDF2 (fallback)
    if not text_content.strip():
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    try:
                        text_content += page.extract_text() + "\n"
                    except Exception as page_error:
                        print(f"Warning: PyPDF2 page extraction failed: {page_error}")
                        continue
        except Exception as e:
            print(f"PyPDF2 failed for {pdf_path}: {e}")
    
    return text_content

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
    
    # Extract project info from filename
    if "SO" in filename:
        so_match = re.search(r'SO (\d+)', filename)
        if so_match:
            data["project_info"]["so_number"] = so_match.group(1)
    
    if "km" in filename:
        km_match = re.search(r'km ([\d,]+)', filename)
        if km_match:
            data["project_info"]["km_position"] = km_match.group(1)
    
    # Extract prices and items (basic pattern matching)
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
    
    # Extract offer number
    offer_match = re.search(r'(\d{3}-\d{6})', filename)
    if offer_match:
        data["offer_info"]["offer_number"] = offer_match.group(1)
    
    # Extract DOKA items and prices
    doka_patterns = [
        r'DOKA\s+([^\n]+)\s+(\d+[\s,]\d+)',
        r'([A-Z0-9-]+)\s+(\d+[\s,]\d+)\s*Kč'
    ]
    
    for pattern in doka_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            data["items"].append({
                "item": match[0].strip(),
                "price": match[1],
                "currency": "CZK"
            })
    
    return data

def process_pdf_files():
    """Process all PDF files in the directory"""
    current_dir = Path(__file__).parent
    pdf_files = list(current_dir.glob("*.pdf"))
    
    extracted_data = []
    
    for pdf_file in pdf_files:
        print(f"Processing: {pdf_file.name}")
        
        try:
            text = extract_pdf_text(pdf_file)
            
            if not text.strip():
                print(f"No text extracted from {pdf_file.name}")
                continue
            
            # Determine file type and parse accordingly
            if "DOKA" in pdf_file.name.upper() or "540-044877" in pdf_file.name:
                data = parse_doka_offer(text, pdf_file.name)
            else:
                data = parse_bridge_project(text, pdf_file.name)
            
            extracted_data.append(data)
            
            # Save individual file data
            output_file = current_dir / f"{pdf_file.stem}_extracted.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            # Save raw text
            txt_file = current_dir / f"{pdf_file.stem}_raw_text.txt"
            with open(txt_file, 'w', encoding='utf-8') as f:
                f.write(text)
            
            print(f"[OK] Extracted: {pdf_file.name}")
            
        except Exception as e:
            print(f"[ERROR] Error processing {pdf_file.name}: {e}")
    
    # Save combined data
    combined_file = current_dir / "all_pdf_extractions.json"
    with open(combined_file, 'w', encoding='utf-8') as f:
        json.dump(extracted_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n[DONE] Processed {len(extracted_data)} PDF files")
    print(f"[INFO] Results saved in: {current_dir}")

if __name__ == "__main__":
    process_pdf_files()