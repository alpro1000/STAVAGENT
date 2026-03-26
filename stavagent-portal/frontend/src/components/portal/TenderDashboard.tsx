/**
 * TenderDashboard — universal procurement data display.
 * Works for any project type (bridge, building, road, electrical, etc.)
 * Renders only sections that have data (data-driven).
 */

import type { CSSProperties, ReactNode } from 'react';
import type { TenderExtraction } from '../../types/passport';

interface TenderDashboardProps {
  tender: TenderExtraction;
}

function formatCZK(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' Kč';
}

export default function TenderDashboard({ tender }: TenderDashboardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 1. Identification */}
      <DSection title="Identifikace zakázky">
        <FieldGrid fields={[
          { label: 'Název zakázky', value: tender.tender_name },
          { label: 'Číslo zakázky', value: tender.tender_number },
          { label: 'Evidenční číslo', value: tender.evidence_number },
          { label: 'Druh řízení', value: tender.procedure_type },
          { label: 'Zadavatel', value: tender.contracting_authority },
          { label: 'IČO', value: tender.authority_ico },
          { label: 'Kontaktní osoba', value: tender.contact_person },
          { label: 'Datová schránka', value: tender.data_box },
          { label: 'Projektant', value: tender.designer },
          { label: 'Typ smlouvy', value: tender.contract_type },
        ]} />
      </DSection>

      {/* 2. Value */}
      {tender.estimated_value_czk != null && (
        <DSection title="Předpokládaná hodnota">
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#FF9F1C' }}>
            {formatCZK(tender.estimated_value_czk)}
          </div>
          {tender.estimated_value_note && (
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {tender.estimated_value_note}
            </div>
          )}
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {tender.vat_note || 'bez DPH'} · {tender.currency || 'CZK'}
          </div>
        </DSection>
      )}

      {/* 3. Qualification — Personnel */}
      {tender.required_personnel && tender.required_personnel.length > 0 && (
        <DSection title="Požadavky na personál">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Pozice</th>
                <th style={thStyle}>Popis reference</th>
                <th style={thStyle}>Autorizace</th>
              </tr>
            </thead>
            <tbody>
              {tender.required_personnel.map((p, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{p.role}</td>
                  <td style={tdStyle}>{p.reference_description}</td>
                  <td style={tdStyle}>{p.authorization_required || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DSection>
      )}

      {/* 3b. Qualification — References */}
      {tender.required_references && tender.required_references.length > 0 && (
        <DSection title="Požadované reference">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Kód</th>
                <th style={thStyle}>Popis</th>
                <th style={thStyle}>Min. hodnota</th>
              </tr>
            </thead>
            <tbody>
              {tender.required_references.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.reference_code}</td>
                  <td style={tdStyle}>{r.description}</td>
                  <td style={tdStyle}>{r.min_value_czk ? formatCZK(r.min_value_czk) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DSection>
      )}

      {/* 3c. Economic */}
      {tender.min_annual_turnover_czk != null && (
        <DSection title="Ekonomická kvalifikace">
          <FieldGrid fields={[
            { label: 'Min. roční obrat', value: formatCZK(tender.min_annual_turnover_czk) },
            { label: 'Období', value: tender.turnover_period },
            { label: 'Poznámka', value: tender.turnover_note },
          ]} />
        </DSection>
      )}

      {/* 4. Evaluation criteria */}
      {tender.evaluation_criteria && tender.evaluation_criteria.length > 0 && (
        <DSection title="Hodnotící kritéria">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Kritérium</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Váha %</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Směr</th>
              </tr>
            </thead>
            <tbody>
              {tender.evaluation_criteria.map((ec, i) => (
                <tr key={i}>
                  <td style={tdStyle}>{ec.name}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{ec.weight_pct}%</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontSize: '12px' }}>
                    {ec.direction === 'lower_better' ? '↓ nižší = lepší' : '↑ vyšší = lepší'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DSection>
      )}

      {/* 5. Submission */}
      <DSection title="Podání nabídek">
        <FieldGrid fields={[
          { label: 'Způsob podání', value: tender.submission_method },
          { label: 'Elektronický nástroj', value: tender.electronic_tool },
          { label: 'Lhůta pro podání', value: tender.submission_deadline },
          { label: 'Max. velikost souboru', value: tender.max_file_size_mb ? `${tender.max_file_size_mb} MB` : null },
          { label: 'Povolené formáty', value: tender.accepted_formats?.join(', ') },
          { label: 'Papírové podání', value: tender.paper_submission_allowed ? 'Ano' : 'Ne' },
        ]} />
      </DSection>

      {/* 6. Binding period + Jistota */}
      {(tender.binding_period_months != null || tender.jistota_required) && (
        <DSection title="Zadávací lhůta a jistota">
          <FieldGrid fields={[
            { label: 'Zadávací lhůta', value: tender.binding_period_months ? `${tender.binding_period_months} měsíců` : null },
            { label: 'Jistota požadována', value: tender.jistota_required ? 'Ano' : 'Ne' },
            { label: 'Výše jistoty', value: tender.jistota_amount_czk ? formatCZK(tender.jistota_amount_czk) : null },
            { label: 'Formy jistoty', value: tender.jistota_forms?.join(', ') },
            { label: 'Bankovní účet', value: tender.jistota_bank_account },
            { label: 'Variabilní symbol', value: tender.jistota_variable_symbol },
          ]} />
        </DSection>
      )}

      {/* 7. Subcontracting */}
      {((tender.own_capacity_required?.length ?? 0) > 0 || tender.subcontracting_limit) && (
        <DSection title="Poddodavatelé">
          <FieldGrid fields={[
            { label: 'Omezení poddodávek', value: tender.subcontracting_limit },
            { label: 'Vlastní kapacity', value: tender.own_capacity_required?.join('; ') },
          ]} />
        </DSection>
      )}

      {/* 8. Attachments */}
      {tender.attachments && tender.attachments.length > 0 && (
        <DSection title="Přílohy zadávací dokumentace">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {tender.attachments.map((a, i) => (
              <div key={i} style={{ fontSize: '13px' }}>
                <strong>Příloha č. {a.number}:</strong> {a.name}
              </div>
            ))}
          </div>
        </DSection>
      )}

      {/* 9. Risk flags */}
      {tender.risk_flags && tender.risk_flags.length > 0 && (
        <DSection title="Rizikové faktory">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {tender.risk_flags.map((flag, i) => (
              <div
                key={i}
                style={{
                  fontSize: '13px',
                  padding: '6px 12px',
                  backgroundColor: '#fdf0ef',
                  borderLeft: '3px solid #e74c3c',
                  borderRadius: '2px',
                }}
              >
                {flag}
              </div>
            ))}
          </div>
        </DSection>
      )}
    </div>
  );
}

// Section wrapper
function DSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="c-panel" style={{ padding: '16px' }}>
      <h4 style={{
        margin: '0 0 12px',
        fontSize: '14px',
        fontWeight: 700,
        color: '#FF9F1C',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

// Generic field grid — renders only non-null fields
function FieldGrid({ fields }: { fields: Array<{ label: string; value: any }> }) {
  const visible = fields.filter(f => f.value != null && f.value !== '' && f.value !== false);
  if (visible.length === 0) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '8px',
    }}>
      {visible.map((f, i) => (
        <div key={i} style={{ padding: '4px 0' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {f.label}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>
            {typeof f.value === 'boolean' ? (f.value ? 'Ano' : 'Ne') : String(f.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
};

const thStyle: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '2px solid var(--border-color, #e0e0e0)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  textAlign: 'left',
  color: 'var(--text-secondary)',
  letterSpacing: '0.4px',
};

const tdStyle: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--border-color, #f0f0f0)',
};
