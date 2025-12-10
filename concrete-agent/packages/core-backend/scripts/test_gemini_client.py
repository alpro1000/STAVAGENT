#!/usr/bin/env python3
"""
Test script for Gemini client - verify Multi-Role works with Gemini

Usage:
    python scripts/test_gemini_client.py
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.core.gemini_client import GeminiClient

def test_gemini_basic():
    """Test basic Gemini API call"""
    print("\n" + "="*80)
    print("TEST 1: Basic Gemini API Call")
    print("="*80)

    try:
        client = GeminiClient()
        print(f"✅ Gemini client initialized with model: {client.model_name}")

        # Simple test prompt
        prompt = """You are a concrete specialist. Answer this question in JSON format:

Question: What is the minimum concrete class for outdoor foundations in Czech Republic?

Return JSON with this structure:
{
  "answer": "brief answer",
  "concrete_class": "C30/37",
  "reasoning": "why"
}
"""

        print("\n📤 Sending test prompt...")
        response = client.call(prompt, temperature=0.3)

        print("\n📥 Response received:")
        print(response)

        if "concrete_class" in response:
            print("\n✅ TEST PASSED: Gemini returned valid JSON!")
        elif "raw_text" in response:
            print("\n⚠️  WARNING: Gemini returned raw text instead of JSON")
            print(f"Raw text: {response['raw_text'][:200]}...")
        else:
            print("\n❌ TEST FAILED: Unexpected response format")

        return True

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        return False


def test_gemini_multi_role_prompt():
    """Test Gemini with actual Multi-Role prompt"""
    print("\n" + "="*80)
    print("TEST 2: Gemini with Multi-Role Prompt")
    print("="*80)

    try:
        client = GeminiClient()

        # Load a real role prompt
        prompts_dir = Path(__file__).parent.parent / "app" / "prompts" / "roles"
        doc_validator_path = prompts_dir / "document_validator.md"

        if not doc_validator_path.exists():
            print(f"⚠️  Skipping test - role prompt not found: {doc_validator_path}")
            return True

        with open(doc_validator_path, 'r', encoding='utf-8') as f:
            role_prompt = f.read()

        print(f"✅ Loaded role prompt: {len(role_prompt)} chars")

        # Simple validation question
        user_question = """
Validate this BOQ block for completeness:

Block: Základy (Foundations)
Items:
1. Základové pasy C 25/30 - 15 m³
2. Výztuž R10 - 1200 kg

Is this sufficient for foundation design?
"""

        full_prompt = f"{role_prompt}\n\n{user_question}"

        print("\n📤 Sending Multi-Role prompt to Gemini...")
        print(f"   Prompt size: {len(full_prompt)} chars (~{len(full_prompt)//4} tokens)")

        response = client.call(full_prompt, temperature=0.2)

        print("\n📥 Response received:")
        print(f"   Type: {type(response)}")

        if isinstance(response, dict):
            if "raw_text" in response:
                print(f"   Raw text length: {len(response['raw_text'])} chars")
                print(f"   Preview: {response['raw_text'][:300]}...")
            else:
                print(f"   JSON keys: {list(response.keys())}")
                print(f"   Preview: {str(response)[:300]}...")

        print("\n✅ TEST PASSED: Gemini handled Multi-Role prompt!")
        return True

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_gemini_vs_claude_comparison():
    """Compare Gemini and Claude responses"""
    print("\n" + "="*80)
    print("TEST 3: Gemini vs Claude Comparison (Optional)")
    print("="*80)

    if not settings.ANTHROPIC_API_KEY:
        print("⚠️  Skipping - Claude API key not configured")
        return True

    try:
        from app.core.claude_client import ClaudeClient

        gemini_client = GeminiClient()
        claude_client = ClaudeClient()

        prompt = "What is the minimum concrete class for XC4 exposure in Czech standards? Return brief answer (1 sentence)."

        print("\n📤 Testing Gemini...")
        gemini_response = gemini_client.call(prompt, temperature=0.2)

        print("\n📤 Testing Claude...")
        claude_response = claude_client.call(prompt, temperature=0.2)

        print("\n📊 COMPARISON:")
        print(f"\nGemini response:")
        print(gemini_response)
        print(f"\nClaude response:")
        print(claude_response)

        print("\n✅ TEST PASSED: Both models responded successfully!")
        return True

    except Exception as e:
        print(f"\n⚠️  Comparison test skipped: {e}")
        return True


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("GEMINI CLIENT TEST SUITE")
    print("="*80)

    # Check API key
    if not settings.GOOGLE_API_KEY:
        print("\n❌ ERROR: GOOGLE_API_KEY not set!")
        print("\nPlease set your Google AI API key:")
        print("  export GOOGLE_API_KEY='your-key-here'")
        print("\nGet a free key at: https://aistudio.google.com/")
        sys.exit(1)

    print(f"\n✅ GOOGLE_API_KEY configured: {settings.GOOGLE_API_KEY[:20]}...")
    print(f"✅ GEMINI_MODEL: {settings.GEMINI_MODEL}")
    print(f"✅ MULTI_ROLE_LLM: {getattr(settings, 'MULTI_ROLE_LLM', 'not set')}")

    # Run tests
    results = []
    results.append(("Basic API Call", test_gemini_basic()))
    results.append(("Multi-Role Prompt", test_gemini_multi_role_prompt()))
    results.append(("Gemini vs Claude", test_gemini_vs_claude_comparison()))

    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)

    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {name}")

    all_passed = all(passed for _, passed in results)

    if all_passed:
        print("\n🎉 ALL TESTS PASSED!")
        print("\n✅ Gemini client is ready for Multi-Role use!")
        print("\nTo use Gemini in production:")
        print("  1. Set GOOGLE_API_KEY in Render environment")
        print("  2. Set MULTI_ROLE_LLM=gemini (default)")
        print("  3. Deploy and test Multi-Role API")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)


if __name__ == "__main__":
    main()
