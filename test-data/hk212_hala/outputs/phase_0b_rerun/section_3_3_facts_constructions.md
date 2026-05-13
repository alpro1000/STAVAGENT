# §3.3 — Konstrukce

## Steel frame — TZ statika D.1.2 + 05_konstrukce_titul + A101 DXF counts

| Element | Profil + materiál | DXF INSERT count (A101) | Source TZ |
|---|---|---:|---|
| Sloupy rámové | **IPE 400 S235** | **36** | TZ B p02 "sloupy IPE"; statika p23 detail; 05_konstrukce_titul × 22 IPE400 labels |
| Sloupy štítové | **HEA 200 S235** | **8** (M_S profily blocks) | TZ D.1.1 p03: "sloupy ve štítu pod rámem budou z nosníků HEA 200"; 05_konstrukce_titul × 4 HEA200 labels |
| Příčle rámu | **IPE 450 S235** | (počet 5 na A101 jako 'IPE -' blocks; každý rám = 1 příčel ze 2 dílů = 10 hlavních + 2 štítové) | TZ D.1.1 p03: "IPE 450 se sklonem 5,25°"; 05_konstrukce_titul × 8 IPE450 labels |
| Vaznice střešní | **IPE 160 S235** | (mimo INSERT — drawn as LINE entities) | TZ statika D.1.2 p23: "vaznice IPE 160 S235" + 05_konstrukce_titul × ~24 VAZNICE IPE160 labels |
| Krajní vaznice | **UPE 160 S235** (drift A104 C150×19,3 — viz §9.5) | (mimo INSERT; A104 má 2× C150X19_3 v Řez 2+3 jako legacy block) | TZ B p02 + statika D.1.2 p23 + 05_konstrukce_titul × 19 KRAJNÍ VAZNICE UPE160 labels |
| Ztužidla střešní (kruhové tyče) | **Ø20 R20 S235** ("ondřejskými kříži z profilu R20") | **8** | TZ D.1.1 p04 |
| Ztužidla stěnová | **L 70/70/6 S235** | (mimo INSERT) | TZ B p03 "L70/70/6 z oceli S235" + 05_konstrukce_titul "STĚNOVÁ ZTUŽIDLA Z L70/70/6" |

## Foundations — A105 + TZ statika

| Element | Rozměr [m] | Beton | Hloubka | Source |
|---|---|---|---|---|
| Patky rámové (14 ks) | 1,5 × 1,5 × **(2 × 0,6) = 1,2 m total** (dvoustupňová) | **C16/20 XC0** | -1,300 / -1,900 (z A105 výškové kóty) | TZ statika D.1.2 p31 + A105 MTEXT |
| Patky štítové (10 ks) | 0,8 × 0,8 × **(0,2 + 0,6) = 0,8 m total** (dvoustupňová) | **C16/20 XC0** | -0,700 / -1,300 | TZ statika D.1.2 p31 + A105 |
| Atypický základ / pilota (1 ks) | Ø 800 × L = 8,0 m | **C25/30 XC4 + 8×R25 B500B + třmínky R10 á 200 mm** | dle IGP | TZ statika D.1.2 p32 + A105 explicit MTEXT |
| Základová deska | tl. 200 mm | **C25/30 XC4 + Kari síť Ø8 100/100 oba povrchy B500B krytí 30 mm** | 0,200 nad terén | TZ statika D.1.2 p29 |