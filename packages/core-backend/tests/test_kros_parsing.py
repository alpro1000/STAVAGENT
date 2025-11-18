"""
Test script for KROS UNIXML parsing
Запуск: python test_kros_parsing.py
"""
import sys
from pathlib import Path
import json

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.claude_client import ClaudeClient
from app.core.config import settings


def test_kros_unixml_parsing():
    """Test KROS UNIXML file parsing"""
    
    print("=" * 80)
    print("KROS UNIXML PARSING TEST")
    print("=" * 80)
    
    # Setup
    client = ClaudeClient()
    
    # Test file path (замените на ваш файл)
    test_xml_path = Path("test_files/RD_Valcha_SO1_SO2.xml")
    
    if not test_xml_path.exists():
        print(f"❌ Test file not found: {test_xml_path}")
        print(f"   Please place your KROS XML file at: {test_xml_path}")
        return False
    
    print(f"✅ Found test file: {test_xml_path}")
    print(f"   File size: {test_xml_path.stat().st_size:,} bytes")
    
    # Check if UNIXML format
    with open(test_xml_path, 'r', encoding='utf-8') as f:
        content = f.read(1000)  # First 1000 chars
        if '<unixml' in content.lower():
            print("✅ Confirmed UNIXML format")
        else:
            print("⚠️  Warning: Not UNIXML format (missing <unixml> tag)")
    
    print("\n" + "=" * 80)
    print("PARSING...")
    print("=" * 80)
    
    try:
        # Parse XML
        result = client.parse_xml(test_xml_path)
        
        print("\n✅ PARSING SUCCESSFUL!")
        print("=" * 80)
        
        # Display document info
        doc_info = result.get('document_info', {})
        print(f"\n📄 DOCUMENT INFO:")
        print(f"   Type: {doc_info.get('document_type', 'N/A')}")
        print(f"   Project Code: {doc_info.get('project_code', 'N/A')}")
        print(f"   Project Name: {doc_info.get('project_name', 'N/A')}")
        print(f"   Date: {doc_info.get('date', 'N/A')}")
        print(f"   Source: {doc_info.get('source_system', 'N/A')}")
        
        # Display objects
        objects = result.get('objects', [])
        print(f"\n🏗️  OBJECTS ({len(objects)}):")
        for obj in objects:
            print(f"   - {obj.get('object_code')}: {obj.get('object_name')} ({obj.get('position_count', 0)} pozic)")
        
        # Display positions summary
        positions = result.get('positions', [])
        total = result.get('total_positions', len(positions))
        
        print(f"\n📋 POSITIONS:")
        print(f"   Total parsed: {len(positions)}")
        print(f"   Total reported: {total}")
        
        if len(positions) != total:
            print(f"   ⚠️  Warning: Mismatch between parsed and reported count!")
        
        # Display first 3 positions
        print(f"\n📝 FIRST 3 POSITIONS:")
        for i, pos in enumerate(positions[:3], 1):
            print(f"\n   Position {i}:")
            print(f"   - Code: {pos.get('position_code', 'N/A')}")
            print(f"   - Description: {pos.get('description', 'N/A')[:60]}...")
            print(f"   - Quantity: {pos.get('quantity', 'null')} {pos.get('unit', '')}")
            print(f"   - Unit Price: {pos.get('unit_price', 'null')}")
            print(f"   - Total Price: {pos.get('total_price', 'null')}")
            print(f"   - Object: {pos.get('object_code', 'N/A')}")
            print(f"   - Category: {pos.get('category', 'N/A')}")
            print(f"   - Section: {pos.get('section', 'N/A')} - {pos.get('section_name', 'N/A')}")
        
        # Check for missing data
        print(f"\n📊 DATA COMPLETENESS:")
        positions_with_quantity = sum(1 for p in positions if p.get('quantity') is not None)
        positions_with_price = sum(1 for p in positions if p.get('unit_price') is not None)
        positions_with_total = sum(1 for p in positions if p.get('total_price') is not None)
        
        print(f"   Positions with quantity: {positions_with_quantity}/{len(positions)} ({positions_with_quantity/len(positions)*100:.1f}%)")
        print(f"   Positions with unit price: {positions_with_price}/{len(positions)} ({positions_with_price/len(positions)*100:.1f}%)")
        print(f"   Positions with total price: {positions_with_total}/{len(positions)} ({positions_with_total/len(positions)*100:.1f}%)")
        
        if positions_with_quantity == 0:
            print(f"   ⚠️  No quantities found - XML may not contain <mnozstvi> tags")
        
        if positions_with_price == 0:
            print(f"   ⚠️  No prices found - XML may not contain <jednotkova_cena> tags")
        
        # Category breakdown
        print(f"\n📦 CATEGORY BREAKDOWN:")
        categories = {}
        for pos in positions:
            cat = pos.get('category', 'Unknown')
            categories[cat] = categories.get(cat, 0) + 1
        
        for cat, count in sorted(categories.items()):
            print(f"   {cat}: {count} positions ({count/len(positions)*100:.1f}%)")
        
        # Save full result to file
        output_file = Path("test_output_kros_parsing.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Full result saved to: {output_file}")
        
        print("\n" + "=" * 80)
        print("✅ TEST COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ PARSING FAILED!")
        print(f"   Error: {str(e)}")
        print("\n" + "=" * 80)
        import traceback
        traceback.print_exc()
        return False


def check_xml_structure():
    """Quick check of XML structure without parsing"""
    
    test_xml_path = Path("test_files/RD_Valcha_SO1_SO2.xml")
    
    if not test_xml_path.exists():
        print(f"❌ File not found: {test_xml_path}")
        return
    
    print("=" * 80)
    print("XML STRUCTURE CHECK")
    print("=" * 80)
    
    with open(test_xml_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Detect format first
    print("\n🔍 FORMAT DETECTION:")
    if '<unixml' in content.lower():
        print("✅ Format: KROS UNIXML (Soupis prací)")
        format_type = "unixml"
    elif '<TZ>' in content or '<Row>' in content:
        print("✅ Format: KROS Table XML (Kalkulace s cenami)")
        format_type = "table"
    else:
        print("⚠️  Format: Unknown XML")
        format_type = "unknown"
    
    # Count key elements based on format
    if format_type == "unixml":
        checks = {
            '<unixml': 'UNIXML format',
            '<stavba>': 'Project (stavba)',
            '<objekt>': 'Object (objekt)',
            '<zdroj_konstrukce>': 'Position (zdroj_konstrukce)',
            '<kod_polozky>': 'Position code',
            '<zkraceny_popis_polozky>': 'Short description',
            '<merna_jednotka>': 'Unit',
            '<mnozstvi>': 'Quantity ⚠️ IMPORTANT',
            '<jednotkova_cena>': 'Unit price ⚠️ IMPORTANT',
            '<celkova_cena>': 'Total price'
        }
    elif format_type == "table":
        checks = {
            '<TZ>': 'Table root',
            '<Row>': 'Table rows',
            '<A>': 'Column A (position number)',
            '<B>': 'Column B (code)',
            '<C>': 'Column C (description)',
            '<D>': 'Column D (unit)',
            '<F>': 'Column F (quantity) ⚠️ IMPORTANT',
            '<G>': 'Column G (unit price) ⚠️ IMPORTANT',
            '<H>': 'Column H (total price) ⚠️ IMPORTANT'
        }
    else:
        checks = {}
    
    if checks:
        print("\n🔍 CHECKING XML ELEMENTS:")
        for tag, desc in checks.items():
            count = content.count(tag)
            status = "✅" if count > 0 else "❌"
            print(f"{status} {desc:35} → Found {count:4} times")
            
            if count == 0 and 'IMPORTANT' in desc:
                print(f"   ⚠️  This is important data - may be missing in export!")
    
    # Show sample rows for table format
    if format_type == "table":
        print("\n📋 SAMPLE DATA (first 3 position rows):")
        import re
        rows = re.findall(r'<Row>.*?</Row>', content, re.DOTALL)
        position_count = 0
        for row in rows:
            # Check if it's a position (has code in <B> and quantity in <F>)
            b_match = re.search(r'<B>(\d{6,})</B>', row)
            f_match = re.search(r'<F>([\d.]+)</F>', row)
            if b_match and f_match:
                position_count += 1
                if position_count <= 3:
                    code = b_match.group(1)
                    qty = f_match.group(1)
                    c_match = re.search(r'<C>(.*?)</C>', row)
                    desc = c_match.group(1)[:50] if c_match else "N/A"
                    g_match = re.search(r'<G>([\d.]+)</G>', row)
                    price = g_match.group(1) if g_match else "N/A"
                    
                    print(f"\n   Position {position_count}:")
                    print(f"   - Code: {code}")
                    print(f"   - Description: {desc}...")
                    print(f"   - Quantity: {qty}")
                    print(f"   - Unit Price: {price}")
        
        print(f"\n   Total positions found: {position_count}")
    
    print("\n" + "=" * 80)


if __name__ == "__main__":
    print("\n")
    
    # First check structure
    print("STEP 1: Check XML structure\n")
    check_xml_structure()
    
    print("\n" * 2)
    
    # Then try parsing
    print("STEP 2: Parse XML with Claude\n")
    success = test_kros_unixml_parsing()
    
    if success:
        print("\n🎉 All tests passed!")
    else:
        print("\n❌ Tests failed - check errors above")
