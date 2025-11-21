"""
Test that enrichment service uses correct KB method
"""
import asyncio
from app.core.kb_loader import get_knowledge_base
from app.services.enrichment_service import PositionEnricher

async def test_enrich():
    print("=" * 80)
    print("TESTING ENRICHMENT FIX")
    print("=" * 80)

    # Initialize service (it will get KB internally)
    enrichment = PositionEnricher()

    # Test position
    test_position = {
        "code": "272325",
        "description": "ZÁKLADY ZE ŽELEZOBETONU DO C30/37",
        "unit": "M3",
        "quantity": 225.57
    }

    print(f"\nTest position: {test_position['code']} - {test_position['description']}")

    try:
        # This should now work without AttributeError
        enriched = await enrichment._enrich_from_kb(test_position)

        print("\n[SUCCESS] No AttributeError!")
        print(f"\nEnriched data:")
        print(f"  - kb_code: {enriched.get('kb_code')}")
        print(f"  - kb_name: {enriched.get('kb_name')}")
        print(f"  - kb_unit: {enriched.get('kb_unit')}")
        print(f"  - kb_category: {enriched.get('kb_category')}")
        print(f"  - kb_source: {enriched.get('kb_source')}")

        if enriched.get('kb_source') == 'OTSKP_2024':
            print("\n[OK] Found in Knowledge Base!")
        else:
            print(f"\n[WARNING] Not found in KB (code: {test_position['code']})")

    except AttributeError as e:
        print(f"\n[ERROR] {e}")
        print("The fix didn't work!")

    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")

    print("\n" + "=" * 80)

if __name__ == "__main__":
    asyncio.run(test_enrich())
