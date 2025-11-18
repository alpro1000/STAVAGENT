import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

export default function MaterialsDetailed({ data }) {
  const [expandedMaterial, setExpandedMaterial] = useState(null);
  const [filterType, setFilterType] = useState('all');

  if (!data) return <div className="text-gray-500">Žádná data</div>;

  const { materials = [], summary = {} } = data;

  // Get unique material types for filtering
  const materialTypes = ['all', ...new Set(materials.map((m) => m.type))];

  // Filter materials
  const filteredMaterials =
    filterType === 'all'
      ? materials
      : materials.filter((m) => m.type === filterType);

  return (
    <div className="space-y-3">
      {/* Summary */}
      {summary.total_materials && (
        <div className="bg-blue-50 p-2 rounded border border-blue-200 text-xs">
          <strong>Celkem materiálů:</strong> {summary.total_materials} |{' '}
          <strong>Typů:</strong> {summary.material_types?.length || 0} |{' '}
          <strong>Orientační náklady:</strong> {Number(summary.total_cost || 0).toLocaleString('cs-CZ')} Kč
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 items-center overflow-x-auto pb-2">
        <Filter size={16} className="text-gray-600" />
        {materialTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition ${
              filterType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {type === 'all' ? '✓ Vše' : type}
          </button>
        ))}
      </div>

      {/* Materials list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredMaterials.map((material, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition"
          >
            {/* Header (always visible) */}
            <button
              onClick={() =>
                setExpandedMaterial(expandedMaterial === i ? null : i)
              }
              className="w-full p-3 flex items-start justify-between hover:bg-gray-50 transition"
            >
              <div className="flex-1 text-left">
                <div className="font-semibold text-sm text-gray-900">
                  {material.brand || material.name}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {material.type} • {material.quantity?.total || '?'} {material.unit || 'ks'}
                </div>
              </div>
              {expandedMaterial === i ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>

            {/* Expanded details */}
            {expandedMaterial === i && (
              <div className="px-3 pb-3 border-t border-gray-200 bg-gray-50 space-y-2 text-xs">
                {/* Characteristics */}
                {material.characteristics && (
                  <div>
                    <strong>Vlastnosti:</strong>
                    <ul className="list-disc list-inside text-gray-700 mt-1">
                      {Object.entries(material.characteristics).map(([key, val]) => (
                        <li key={key}>
                          {key}: {val}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Variants (if applicable) */}
                {material.variants && material.variants.length > 0 && (
                  <div>
                    <strong>Varianty:</strong>
                    <table className="w-full mt-1 text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left">Typ</th>
                          <th className="text-right">Množství</th>
                        </tr>
                      </thead>
                      <tbody>
                        {material.variants.map((v, j) => (
                          <tr key={j} className="border-b">
                            <td>{v.diameter || v.type}</td>
                            <td className="text-right">
                              {v.qty} {v.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Used in sections */}
                {material.used_in && material.used_in.length > 0 && (
                  <div>
                    <strong>Použito v:</strong>
                    {material.used_in.map((usage, j) => (
                      <div key={j} className="text-gray-700 ml-2">
                        {usage.section} - {usage.work}: {usage.qty} {material.unit}
                      </div>
                    ))}
                  </div>
                )}

                {/* Suppliers */}
                {material.suppliers && material.suppliers.length > 0 && (
                  <div>
                    <strong>Dodavatelé:</strong>
                    {material.suppliers.slice(0, 2).map((sup, j) => (
                      <div key={j} className="text-gray-700 ml-2">
                        {sup.name} ({sup.distance}): {sup.price?.toLocaleString('cs-CZ')} Kč/j, {sup.delivery}
                      </div>
                    ))}
                  </div>
                )}

                {/* Norms */}
                {material.norms && material.norms.length > 0 && (
                  <div>
                    <strong>Normy:</strong> {material.norms.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
