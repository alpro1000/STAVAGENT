import React from 'react';

const currency = (value) =>
  typeof value === 'number' ? `${value.toLocaleString()} Kč` : value || '—';

const QuantityBadge = ({ quantity, unit }) => (
  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-700">
    {quantity?.toLocaleString?.() || quantity || '-'} {unit || ''}
  </span>
);

export default function VykazVymer({ data = {}, compact = false }) {
  const { project_name, sections = [], grand_total, totals_by_type = {} } = data;

  return (
    <div className={`space-y-4 ${compact ? 'text-xs' : 'text-sm'}`}>
      {project_name && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 shadow-sm">
          <div className="text-xs uppercase text-purple-600">Projekt</div>
          <div className="text-base font-semibold text-purple-900">{project_name}</div>
          {grand_total && (
            <div className="mt-1 text-sm font-semibold text-purple-800">
              Celkem: {currency(grand_total)}
            </div>
          )}
        </div>
      )}

      {Object.keys(totals_by_type).length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(totals_by_type).map(([type, info]) => (
            <div key={type} className="rounded-lg border border-purple-200 bg-white/80 p-3 text-xs shadow-sm">
              <div className="font-semibold uppercase text-purple-600">{type}</div>
              <div className="text-lg font-bold text-purple-900">
                {info.qty?.toLocaleString?.() || info.qty || '-'} {info.unit || ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.section_id} className="rounded-xl border border-purple-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase text-purple-500">{section.section_id}</div>
                <div className="text-base font-semibold text-purple-900">{section.section_title}</div>
              </div>
              <QuantityBadge quantity={section.section_total} unit="Kč" />
            </div>

            {section.works && section.works.length > 0 && (
              <div className="mt-3 space-y-2">
                {section.works.map((work) => (
                  <div
                    key={work.work_id || work.code}
                    className="rounded-lg border border-purple-100 bg-purple-50/60 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-xs uppercase text-purple-600">{work.code}</div>
                        <div className="text-sm font-semibold text-purple-900">{work.description}</div>
                      </div>
                      <QuantityBadge quantity={work.quantity_total} unit={work.unit} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-purple-700">
                      <span>Jedn. cena: {currency(work.unit_price)}</span>
                      <span>Celkem: {currency(work.total_price)}</span>
                    </div>
                    {work.quantity_by_material && work.quantity_by_material.length > 0 && (
                      <div className="mt-3 text-[11px] text-purple-700">
                        <div className="font-semibold uppercase text-purple-500">Materiálové složení</div>
                        <ul className="mt-1 grid gap-1 md:grid-cols-2">
                          {work.quantity_by_material.map((item) => (
                            <li key={`${item.material}-${item.unit}`} className="rounded bg-white/80 px-2 py-1">
                              {item.material}: {item.qty}{item.unit ? ` ${item.unit}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {sections.length === 0 && (
          <div className="rounded border border-dashed border-purple-200 p-4 text-center text-xs text-purple-500">
            Žádné sekce k zobrazení.
          </div>
        )}
      </div>
    </div>
  );
}
