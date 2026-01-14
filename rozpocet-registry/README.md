# 🏗️ Registr Rozpočtů (Rozpočet Registry)

**Verze:** 1.0.0
**Status:** MVP - Fáze 1 (ve vývoji)
**Projekt:** STAVAGENT Ecosystem

---

## 📋 Popis

**Registr Rozpočtů** je webová aplikace pro správu, klasifikaci a vyhledávání položek ze stavebních rozpočtů (výkazy výměr).

### Klíčové funkce:

- 📥 **Import Excel** — načítání .xlsx/.xls souborů s flexibilní konfigurací
- 🔍 **Pokročilé vyhledávání** — fulltextové vyhledávání napříč všemi projekty
- 📊 **Automatická klasifikace** — AI-asistované třídění položek do skupin
- 🔗 **Traceability** — hyperlinky na původní soubory a řádky
- 📤 **Export s odkazy** — export do Excel s funkcemi a odkazy
- 📁 **Multi-projekt** — práce s více projekty současně

---

## 🚀 Rychlý start

### Prerekvizity

- Node.js 18+
- npm nebo yarn

### Instalace

\`\`\`bash
# Instalace závislostí
npm install

# Spuštění dev serveru
npm run dev

# Build pro produkci
npm run build
\`\`\`

Aplikace běží na: http://localhost:5173

---

## 🏗️ Architektura

### Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS (Digital Concrete Design System)
- **State:** Zustand (persistent store)
- **Tables:** TanStack Table v8
- **Excel:** SheetJS (xlsx)
- **Search:** Fuse.js
- **Icons:** Lucide React

---

## 📚 Datové struktury

### ParsedItem

\`\`\`typescript
interface ParsedItem {
  id: string;                    // UUID
  kod: string;                   // kód položky "231112"
  popis: string;                 // hlavní popis
  skupina: string | null;        // skupina práce
  source: ItemSource;            // zdroj (projekt, list, řádek)
}
\`\`\`

---

## 🎨 Design System

**Digital Concrete / Brutalist Neumorphism**

- Monochrome palette + oranžová accent (#f59e0b)
- Typography: JetBrains Mono, Inter
- Neumorphic shadows

---

## 🗺️ Roadmap

### ✅ Fáze 1: Základní import (aktuální)
- [x] Inicializace projektu
- [x] Design system
- [x] TypeScript typy
- [ ] Excel parser
- [ ] Tabulka položek

### 📅 Fáze 2-7: Další fáze
- Import wizard
- Klasifikace
- Multi-projekt
- Vyhledávání
- Export

---

## 🤝 STAVAGENT Ecosystem

Registr Rozpočtů je samostatný kiosk v ekosystému STAVAGENT.

---

**STAVAGENT © 2026**
