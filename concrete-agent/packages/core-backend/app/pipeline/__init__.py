"""
Universal Document Pipeline — any file → structured summary → project.json

Architecture:
  Layer 0: File intake (validation, format detection)
  Layer 1: Text extraction (pdfplumber, openpyxl, python-docx, MinerU OCR)
  Layer 2: Classification (4-tier: learned → filename → content → AI)
  Layer 3: Regex extraction (deterministic, confidence=1.0)
  Layer 4: AI enrichment (Gemini/Bedrock, confidence=0.7-0.85)
  Layer 5: Cross-validation (multi-document fact matching)
  Layer 6: Project state update (project.json accumulation)
"""
