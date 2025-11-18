import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Users, Zap, Briefcase } from 'lucide-react';

export default function ResourceSheet({ data }) {
  const [expandedSection, setExpandedSection] = useState(0);

  if (!data) return <div className="text-gray-500">Žádná data</div>;

  const { summary, by_section = [], team_composition, equipment_schedule } = data;

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 p-2 rounded border border-blue-200">
            <div className="text-xs text-blue-700 font-semibold">Celk. pracovní hodiny</div>
            <div className="text-lg font-bold text-blue-900">
              {summary.total_labor_hours?.toLocaleString('cs-CZ') || '?'} h
            </div>
          </div>
          <div className="bg-orange-50 p-2 rounded border border-orange-200">
            <div className="text-xs text-orange-700 font-semibold">Stroj. hodiny</div>
            <div className="text-lg font-bold text-orange-900">
              {summary.total_equipment_hours?.toLocaleString('cs-CZ') || '?'} h
            </div>
          </div>
          <div className="bg-green-50 p-2 rounded border border-green-200">
            <div className="text-xs text-green-700 font-semibold">Náklady materiál</div>
            <div className="text-lg font-bold text-green-900">
              {Number(summary.total_materials_cost || 0).toLocaleString('cs-CZ')} Kč
            </div>
          </div>
          <div className="bg-purple-50 p-2 rounded border border-purple-200">
            <div className="text-xs text-purple-700 font-semibold">Odhadovaná doba</div>
            <div className="text-lg font-bold text-purple-900">
              {summary.estimated_duration_days} dní
            </div>
          </div>
        </div>
      )}

      {/* By section */}
      {by_section.map((section, idx) => (
        <div
          key={idx}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => setExpandedSection(expandedSection === idx ? null : idx)}
            className="w-full p-3 bg-gray-50 hover:bg-gray-100 transition flex items-center justify-between"
          >
            <div className="flex-1 text-left">
              <div className="font-semibold text-sm">{section.section}</div>
              <div className="text-xs text-gray-600">
                {section.labor?.total_hours || 0} h práce • {section.section_title}
              </div>
            </div>
            {expandedSection === idx ? (
              <ChevronUp size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>

          {expandedSection === idx && (
            <div className="p-3 space-y-3 border-t border-gray-200 bg-white text-xs">
              {/* Labor */}
              {section.labor && (
                <div>
                  <div className="font-semibold flex items-center gap-2 mb-2">
                    <Users size={16} /> Práce
                  </div>
                  <div className="space-y-1 ml-2">
                    {Object.entries(section.labor.by_trade || {}).map(
                      ([trade, details], i) => (
                        <div key={i} className="text-gray-700">
                          <strong>{trade}:</strong> {details.hours} h ({details.workers} osob)
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Equipment */}
              {section.equipment && (
                <div>
                  <div className="font-semibold flex items-center gap-2 mb-2">
                    <Zap size={16} /> Technika
                  </div>
                  <div className="space-y-1 ml-2">
                    {Object.entries(section.equipment.by_type || {}).map(
                      ([equipment, details], i) => (
                        <div key={i} className="text-gray-700">
                          <strong>{equipment}:</strong> {details.hours} h
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {section.timeline && (
                <div>
                  <div className="font-semibold flex items-center gap-2 mb-2">
                    <Briefcase size={16} /> Harmonogram
                  </div>
                  <div className="ml-2 text-gray-700">
                    Den {section.timeline.start_day}-{section.timeline.end_day} ({
                      section.timeline.end_day - section.timeline.start_day
                    } dní)
                    <br />
                    <em>Kritická cesta: {section.timeline.critical_path}</em>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Team & equipment at bottom */}
      {(team_composition || equipment_schedule) && (
        <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs space-y-2">
          {team_composition && (
            <div>
              <strong>Složení týmu:</strong>
              <div className="ml-2 text-gray-700">
                {Object.entries(team_composition)
                  .map(([role, count]) => `${role}: ${count}`)
                  .join(' • ')}
              </div>
            </div>
          )}

          {equipment_schedule && (
            <div>
              <strong>Technika - plán:</strong>
              <div className="ml-2 text-gray-700 space-y-1">
                {Object.entries(equipment_schedule).map(([name, schedule], i) => (
                  <div key={i}>{name}: {schedule}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
