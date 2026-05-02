/**
 * HelpPanel — full "Nápověda" for the Kalkulátor betonáže.
 *
 * Restored from git commit 67a2bc8^ (pre-refactor PlannerPage.tsx, lines
 * 941–1135) — the refactor that extracted useCalculator + sidebar stripped
 * the panel down to a 5-step cheat sheet. This component brings the full
 * description back: 7-step pipeline, mathematical models, advanced
 * settings, norms, traceability note.
 *
 * Reused CSS class: `.r0-help-grid` (defined in styles/r0.css — 3 columns
 * on desktop, 2 on tablet, 1 on mobile). No new styles introduced.
 */

export interface HelpPanelProps {
  /** Click handler for the "Zavřít nápovědu ✕" button */
  onClose: () => void;
}

export default function HelpPanel({ onClose }: HelpPanelProps) {
  return (
    <div style={{
      background: 'var(--r0-slate-50)', borderBottom: '1px solid var(--r0-slate-200)',
      padding: '20px 24px', fontSize: 13, lineHeight: 1.7, color: 'var(--r0-slate-700)',
      maxHeight: 'calc(100vh - 60px)', overflowY: 'auto', position: 'relative',
    }}>
      <button onClick={onClose} style={{
        position: 'sticky', top: 0, float: 'right', background: 'var(--r0-slate-200)',
        border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
        fontSize: 13, fontWeight: 600, color: 'var(--r0-slate-700)', zIndex: 1,
      }}>Zavřít nápovědu ✕</button>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* ── Intro ── */}
        <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--r0-slate-800)' }}>
          Kalkulátor betonáže — Deterministický výpočet monolitických konstrukcí
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--r0-slate-600)' }}>
          Cíl: <strong>co nejpřesněji spočítat dobu a náklady betonáže</strong> monolitické
          konstrukce — od bednění přes výztuž až po harmonogram a pravděpodobnostní
          odhad termínů. Nepoužívá AI pro výpočty — je založen na <strong>deterministických
          matematických modelech</strong> s daty z norem a katalogů výrobců. AI (Vertex AI Gemini)
          se používá pouze pro doporučení postupu betonáže, ne pro samotné výpočty.
        </p>

        {/* ── Quick Start ── */}
        <div style={{
          background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
        }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--r0-badge-blue-text)' }}>Jak začít (5 kroků)</h4>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Vyberte <strong>typ elementu</strong> (22 typů: mosty + budovy) nebo zadejte název pro AI klasifikaci</li>
            <li>Zadejte <strong>objem betonu</strong> (m³) — povinný údaj</li>
            <li>Volitelně: plocha bednění (m²), hmotnost výztuže (kg) — jinak se odhadnou z profilu</li>
            <li>Nastavte <strong>členění konstrukce</strong> — dilatační celky × záběry v celku</li>
            <li>Klikněte <strong>Vypočítat</strong> — vše se spočítá okamžitě v prohlížeči</li>
          </ol>
        </div>

        {/* ── 3-column grid: Pipeline + Models + Settings ── */}
        <div className="r0-help-grid">

          {/* Column 1: Pipeline */}
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--r0-orange)' }}>
              7-krokový výpočetní pipeline
            </h4>
            <div style={{ fontSize: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <strong>1. Klasifikace elementu</strong>
                <div style={{ color: 'var(--r0-slate-500)' }}>
                  Katalog 22 typů konstrukcí (10 mostních + 12 pozemních).
                  Každý typ má profil: orientace, typická výztuž (kg/m³),
                  maximální rychlost betonáže, doporučené bednění.
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>2. Rozhodnutí o betonáži</strong>
                <div style={{ color: 'var(--r0-slate-500)' }}>
                  Hierarchické členění: dilatační celky × záběry per celek.
                  Engine respektuje pracovní spáry (povoleny / zakázány /
                  nezjištěno), dopočítá T-window (max. doba nepřerušitelné
                  betonáže) a počet čerpadel.
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>3. Bednění — 3-fázový model</strong>
                <div style={{ color: 'var(--r0-slate-500)' }}>
                  Fáze 1: první montáž (+15% přirážka). Fáze 2: přestavba
                  (střední záběry). Fáze 3: finální demontáž (-10%).
                  Normy z katalogů DOKA, PERI, NOE (h/m²). Filtrace systémů
                  dle bočního tlaku (DIN 18218).
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>4. Výztuž (Rebar Lite)</strong>
                <div style={{ color: 'var(--r0-slate-500)' }}>
                  Doba = (hmotnost × norma h/t) ÷ (četa × směna × využití).
                  3-bodový odhad PERT: optimistická (-15%), pesimistická (+30%).
                  Norma ČSN 73 0210: 40–55 h/t dle typu elementu.
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>5. Betonáž (Pour Task)</strong>
                <div style={{ color: 'var(--r0-slate-500)' }}>
                  Analýza úzkého hrdla: efektivní rychlost = MIN(čerpadlo,
                  betonárna, mixéry, omezení elementu). Výpočet počtu
                  čerpadel pro aktuální i cílové okno. Záložní čerpadlo
                  pro MEGA zálivky &gt; 500 m³.
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>6. RCPSP Scheduler</strong>
                <div style={{ color: 'var(--r0-slate-500)' }}>
                  Plánování s omezenými zdroji (čety bednění, čety výztuže,
                  sady bednění). DAG graf závislostí → metoda kritické cesty
                  (CPM) → Ganttův diagram. Šachové pořadí pro sousední sekce.
                </div>
              </div>
              <div>
                <strong>7. PERT Monte Carlo</strong>
                <div style={{ color: 'var(--r0-slate-500)' }}>
                  10 000 simulací s náhodným rozptylem dob → percentily
                  P50/P80/P90/P95. Volitelný krok, zapíná se v nastavení.
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Mathematical Models */}
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--r0-orange)' }}>
              Matematické modely
            </h4>
            <div style={{ fontSize: 12 }}>
              <div style={{
                marginBottom: 10, padding: '8px 10px',
                background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
              }}>
                <strong>RCPSP (Resource-Constrained Project Scheduling)</strong>
                <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                  Orientovaný acyklický graf (DAG): 5 aktivit × N záběrů.
                  Každý záběr = montáž → výztuž → beton → zrání → demontáž.
                  Závislosti: Finish-to-Start (beton po výztuži),
                  Start-to-Start s lagem (výztuž může začít při 50% montáže).
                  Greedy forward pass s prioritním řazením, pak zpětný průchod
                  pro výpočet rezerv (slack). Kritická cesta = aktivity s nulovou rezervou.
                </div>
              </div>
              <div style={{
                marginBottom: 10, padding: '8px 10px',
                background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
              }}>
                <strong>Monte Carlo simulace (PERT)</strong>
                <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                  <em>Co to je:</em> Metoda, která místo jednoho "přesného" čísla
                  dá <strong>pravděpodobnostní rozložení</strong> — s jakou pravděpodobností
                  se stavba vejde do termínu.<br/>
                  <em>Jak funguje:</em> Pro každou aktivitu máme 3 odhady doby
                  (optimistická, nejpravděpodobnější, pesimistická).
                  Simulace 10 000× náhodně vybere dobu z trojúhelníkového
                  rozdělení a sečte kritickou cestu.<br/>
                  <em>Výsledek:</em> P50 = medián (50% šance), P80 = konzervativní
                  plán, P90/P95 = bezpečná rezerva. Vzorec PERT:
                  t = (o + 4m + p) / 6, σ = (p - o) / 6.
                </div>
              </div>
              <div style={{
                marginBottom: 10, padding: '8px 10px',
                background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
              }}>
                <strong>Nurse-Saul Maturity (zrání betonu)</strong>
                <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                  Index zralosti: M = &Sigma;(T - T<sub>datum</sub>) &times; &Delta;t.
                  Dle ČSN EN 13670 Tab. NA.2: minimální doba zrání závisí
                  na teplotě, třídě betonu a typu cementu (CEM I/II/III).
                  Horizontální elementy: 70% f<sub>ck</sub> pro odbednění,
                  vertikální: 50% f<sub>ck</sub>.
                </div>
              </div>
              <div style={{
                marginBottom: 10, padding: '8px 10px',
                background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
              }}>
                <strong>Boční tlak bettonu (DIN 18218)</strong>
                <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                  p = ρ × g × h × k &nbsp;(kN/m²). Koeficient <strong>k</strong> dle
                  konzistence: <em>standard</em> = 0.85, <em>plastický S3–S4</em> = 1.0,
                  <em>SCC</em> = 1.5. Katalog systémů se filtruje podle schopnosti
                  udržet tento tlak + stage count penalty (Framax vs COMAIN pro vysoké pilíře).
                </div>
              </div>
              <div style={{
                padding: '8px 10px',
                background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
              }}>
                <strong>Bottleneck Rate Analysis (betonáž)</strong>
                <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                  Efektivní rychlost = MIN(kapacita čerpadla, výkon
                  betonárny, frekvence mixérů, omezení elementu).
                  Kalkulátor identifikuje úzké hrdlo a varuje,
                  pokud betonáž neprojde do T-window.
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Settings + Norms */}
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--r0-orange)' }}>
              Pokročilé nastavení
            </h4>
            <div style={{ fontSize: 12, marginBottom: 12 }}>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li><strong>Sady bednění</strong> — víc sad = rychlejší rotace mezi záběry</li>
                <li><strong>Čety bednění / výztuže</strong> — počet paralelních čet, ovlivňuje dobu (ne náklady)</li>
                <li><strong>Tesařů / Železářů per četa</strong> — velikost jedné čety, ovlivňuje dobu per úloha</li>
                <li><strong>Směna</strong> — délka pracovního dne (8 / 10 / 12 h dle ZP ČR)</li>
                <li><strong>Využití (k)</strong> — faktor 0.8 = 80% efektivního času (přestávky, logistika)</li>
                <li><strong>Systém bednění</strong> — Frami Xlife, Framax, Top 50, Dokaflex, PERI VARIO, …</li>
                <li><strong>Konzistence betonu</strong> — Standard / Plastický / SCC (pro DIN 18218 k-faktor)</li>
                <li><strong>Pracovní spáry</strong> — povoleny / zakázány / nezjištěno (ověřit v RDS)</li>
                <li><strong>Třída betonu</strong> — C12/15 až C50/60, ovlivňuje dobu zrání</li>
                <li><strong>Typ cementu</strong> — CEM I (rychlý), CEM II (-15%), CEM III (-40%)</li>
                <li><strong>Termín investora</strong> — limit dní, engine navrhne variant konfigurace</li>
              </ul>
            </div>

            <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--r0-orange)' }}>
              Normy a zdroje dat
            </h4>
            <div style={{ fontSize: 12 }}>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li><strong>ČSN EN 13670</strong> — provádění betonových konstrukcí, tabulka zrání NA.2</li>
                <li><strong>ČSN 73 6244</strong> — skruž mostovek, minimální doba ponechání podpěr</li>
                <li><strong>ČSN 73 0210</strong> — výztuž, oborové normy pracnosti (40–55 h/t)</li>
                <li><strong>ČSN EN 206+A2</strong> — trvanlivost betonu, třídy expozice XC/XD/XF</li>
                <li><strong>DIN 18218</strong> — boční tlak čerstvého betonu na bednění</li>
                <li><strong>ČSN EN 12812</strong> — Podpěrná lešení — Požadavky na provedení a obecný návrh</li>
                <li><strong>Zákoník práce §83/§116</strong> — max. směna, příplatky noc / přesčas</li>
                <li><strong>Katalogy DOKA / PERI / NOE / ULMA</strong> — normy montáže/demontáže (h/m²)</li>
                <li><strong>OTSKP (17 904 položek)</strong> — katalog prací pro mosty (regex 11 pravidel)</li>
                <li><strong>KROS</strong> — zaokrouhlení cen: ceil(x/50) × 50</li>
                <li><strong>PMI PMBOK</strong> — PERT, CPM, RCPSP metodika</li>
              </ul>
            </div>

            <div style={{
              marginTop: 12, padding: '8px 10px',
              background: 'var(--r0-warn-bg)', border: '1px solid var(--r0-warn-border)',
              borderRadius: 6, fontSize: 11, color: 'var(--r0-warn-text)',
            }}>
              <strong>Traceabilita:</strong> Každý výpočet je zdokumentován v sekcích
              "Zdroje norem" a "Rozhodovací log" ve výsledcích. Můžete ověřit,
              jaké normy a hodnoty byly použity.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
