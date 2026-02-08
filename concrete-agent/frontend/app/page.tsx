import { FileSearch, ShieldCheck, Zap, ArrowRight, Building2 } from "lucide-react";

const PORTAL_URL = "https://stav-agent.onrender.com";

/* -------------------------------------------------------------------------- */
/*  Feature card data                                                          */
/* -------------------------------------------------------------------------- */

const features = [
  {
    icon: FileSearch,
    title: "Analýza PDF a Výkresů",
    description:
      "Nahrajte dokumentaci a získejte okamžitý přehled klíčových parametrů, objemů betonu a seznamu prací.",
  },
  {
    icon: ShieldCheck,
    title: "Soulad s ČSN",
    description:
      "Automatické ověření projektu proti aktuálním českým technickým normám a stavebním předpisům.",
  },
  {
    icon: Zap,
    title: "Expertní Asistent",
    description:
      "Ptejte se na detaily projektu a generujte technické zprávy s pomocí 6 AI specialistů během vteřin.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--concrete-bg)" }}
    >
      {/* ------------------------------------------------------------------ */}
      {/*  Nav bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <nav
        className="animate-fade-in border-b border-border/40"
        style={{ backgroundColor: "var(--concrete-panel)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Building2
              className="size-7"
              style={{ color: "var(--brand-orange)" }}
              aria-hidden="true"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              STAVAGENT
            </span>
          </div>

          <a
            href={PORTAL_URL}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Otevřít Portál
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/*  Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex flex-1 flex-col">
        <section className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:py-28 lg:py-36">
          {/* Badge */}
          <div
            className="animate-fade-in-up mb-6 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium shadow-neu-sm"
            style={{
              backgroundColor: "var(--concrete-panel)",
              color: "var(--brand-orange)",
            }}
          >
            <Zap className="size-3.5" aria-hidden="true" />
            AI pro české stavebnictví
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up animation-delay-100 mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Inteligentní analýza{" "}
            <span style={{ color: "var(--brand-orange)" }}>
              stavební dokumentace
            </span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-up animation-delay-200 mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Okamžitá kontrola souladu s ČSN a stavebními předpisy. Zrychlete
            svou práci s AI asistentem pro české stavebnictví.
          </p>

          {/* CTA */}
          <div className="animate-fade-in-up animation-delay-300 mt-10">
            <a
              href={PORTAL_URL}
              className="animate-pulse-glow inline-flex items-center gap-2.5 rounded-lg px-8 py-4 text-base font-bold text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
              style={{
                backgroundColor: "var(--brand-orange)",
              }}
              aria-label="Vstoupit do portálu STAVAGENT"
            >
              Vstoupit do Portálu
              <ArrowRight className="size-5" aria-hidden="true" />
            </a>
          </div>

          {/* Social proof */}
          <p className="animate-fade-in-up animation-delay-400 mt-8 text-xs text-muted-foreground">
            6 AI specialistů &middot; ČSN &amp; EN normy &middot; PDF, Excel,
            XLSX
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/*  Features                                                         */}
        {/* ---------------------------------------------------------------- */}
        <section
          className="px-6 py-16 sm:py-20"
          aria-label="Klíčové funkce"
          style={{ backgroundColor: "var(--concrete-surface)" }}
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="animate-fade-in mb-12 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Jak vám pomůže
            </h2>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <article
                  key={feature.title}
                  className={`animate-fade-in-up animation-delay-${(i + 1) * 100} group rounded-xl p-7 transition-transform duration-200 hover:-translate-y-1 shadow-neu`}
                  style={{ backgroundColor: "var(--concrete-panel)" }}
                >
                  {/* Icon */}
                  <div
                    className="mb-4 inline-flex size-12 items-center justify-center rounded-lg shadow-neu-inset"
                    style={{ backgroundColor: "var(--concrete-bg)" }}
                  >
                    <feature.icon
                      className="size-6"
                      style={{ color: "var(--brand-orange)" }}
                      aria-hidden="true"
                    />
                  </div>

                  {/* Title */}
                  <h3 className="mb-2 text-lg font-bold text-foreground">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/*  Footer                                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="border-t border-border/40 px-6 py-8"
        style={{ backgroundColor: "var(--concrete-panel)" }}
      >
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm text-muted-foreground">
            Bezpečné zpracování dat. Vyvinuto pro stavební profesionály.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            &copy; {new Date().getFullYear()} STAVAGENT. Všechna práva
            vyhrazena.
          </p>
        </div>
      </footer>
    </div>
  );
}
