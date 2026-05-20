# TASK: Knowledge L5 RAG Integration (STUB)

> **Verze:** v1-stub
> **Datum:** 2026-05-20
> **Priorita:** P1 (post-CSC, ne blocker)
> **Effort estimate:** ~5-7 dnů Claude Code session
> **Depends on:** Knowledge base ingestion pipeline (`normative_knowledge_base.py` exists)

---

## Účel

Calculator dnes nedělá semantic lookup do učebnic mostů a research papers v GCS bucketu. Tento task přidává **L5 RAG layer**, který:

1. Extrahuje text ze všech PDF v `gs://stavagent-cenik-norms/B6_research_papers/`
2. Vytváří embeddings (Titan / OpenAI / pgvector)
3. Při výpočtu calculator dotazuje RAG: "Pro element=rimsa C30/37 XF4 jaká je doporučená praxe?"
4. Vrátí citace z konkrétních zdrojů (TKP 18 §X.Y, Nečas mosty II str. Z, fib Bulletin 48 ch.W)

---

## Klíčové zdroje k ingest

Z `KNOWLEDGE_PLACEMENT_GUIDE.md` P0 priority:

1. **ČSN EN 13670** — provádění betonových konstrukcí
2. **ČSN EN 206+A2** — beton, materiály
3. **TKP 18 ŘSD 2024** — silniční konstrukce
4. **fib Bulletin 48** — formwork & falsework
5. **DIN 18218:2010** — tlak čerstvého betonu na bednění
6. **Pokorný + Suchánek** — Betonové mosty II (UPa)
7. **Nečas** — Betonové mosty II Modul M01 (VUT)
8. **VUT Bílý** — Příklady navrhování 2G EC2
9. **ACI 347R** — Formwork

---

## Architektura (high-level)

```
GCS bucket (B6, B7) → MinerU OCR → text chunks → embeddings → pgvector
                                                                    ↓
                                                          RAG endpoint
                                                                    ↓
                                                  Calculator pre-flight query
                                                                    ↓
                                                  Response with citations
```

---

## Acceptance criteria (high-level)

1. RAG endpoint `/api/v1/knowledge/rag-search` returns top-K citations for free-text query
2. Calculator response obsahuje `knowledge_sources[]` array s citacemi
3. AI Advisor (existing) může cíleně dotazovat RAG pro element-specific recommendations
4. Confidence scoring: RAG citation > 0.85 cosine similarity → high confidence
5. Coverage test: pro každý z 22 element_types existuje aspoň 3 citace z autoritativních zdrojů (TKP, ČSN, EN, fib)

---

## Connect to říms task

Po implementaci L5 RAG, `TASK_Rimsa_Calibration_FullStack_v1.md` Phase D (Knowledge integration check) bude moct ověřit:
- Pro element=rimsa volá RAG: "říms beton C30/37 XF4 ošetřování" → vrátí citace TKP 18 §7.8.3 + Nečas mosty II §M01.5
- Tyto citace se objeví v calculator response

---

## Out of scope

- Multi-persona AI Advisor (separate task `TASK_AI_Advisor_Triangulation_v1.md`)
- Vision (drawings) RAG — separate task
- Multilingual RAG (CZ/SK/EN/DE)

---

## Naming rule

> Naming a strukturu souborů určuj podle existujících konvencí v repo.
> Nevytvářej paralelní struktury. Rozšiřuj existující kód `normative_knowledge_base.py`.

---

**Author:** STAVAGENT knowledge integration gap analysis, 2026-05-20
