/**
 * Analysis Preview Component
 * Displays results from CORE Engine analysis
 * Shows parsed positions, materials, and dimensions
 */

import { useState } from 'react';

interface Position {
  name: string;
  description: string;
  unit: string;
  quantity: number;
  category?: string;
  otskp_code?: string;
}

interface Material {
  name: string;
  quantity: number;
  unit: string;
}

interface AnalysisResult {
  id: string;
  workflow_id: string;
  workflow_type: string;
  status: string;
  parsed_positions: Position[];
  materials: Material[];
  dimensions: Record<string, any>;
  error_message?: string;
  created_at: string;
}

interface AnalysisPreviewProps {
  analysis: AnalysisResult;
  document: any;
  onConfirm: (workListTitle?: string) => void;
  onDelete: () => void;
}

export default function AnalysisPreview({
  analysis,
  document,
  onConfirm,
  onDelete
}: AnalysisPreviewProps) {
  const [activeTab, setActiveTab] = useState<'positions' | 'materials' | 'dimensions'>('positions');
  const [workListTitle, setWorkListTitle] = useState('');
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(workListTitle);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: '#f7fafc',
        padding: '20px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1a202c',
          marginBottom: '8px'
        }}>
          Analysis Results
        </h2>
        <p style={{
          color: '#718096',
          fontSize: '13px'
        }}>
          Workflow: {analysis.workflow_type === 'workflow-a' ? 'Import & Audit' : 'Drawing Analysis'}
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        background: '#f9fafb'
      }}>
        {(['positions', 'materials', 'dimensions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === tab ? 'white' : 'transparent',
              borderBottom: activeTab === tab ? '2px solid #667eea' : 'none',
              cursor: 'pointer',
              color: activeTab === tab ? '#667eea' : '#718096',
              fontWeight: activeTab === tab ? '500' : '400',
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
          >
            {tab === 'positions' && `📋 Positions (${analysis.parsed_positions.length})`}
            {tab === 'materials' && `📦 Materials (${analysis.materials.length})`}
            {tab === 'dimensions' && `📐 Dimensions`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {/* Positions Tab */}
        {activeTab === 'positions' && (
          <div>
            {analysis.parsed_positions.length === 0 ? (
              <p style={{ color: '#718096', textAlign: 'center', padding: '20px 0' }}>
                No positions found in analysis
              </p>
            ) : (
              <div>
                {analysis.parsed_positions.map((pos, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      background: idx % 2 === 0 ? '#f9fafb' : 'white',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      borderLeft: '3px solid #667eea'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start',
                      marginBottom: '6px'
                    }}>
                      <div>
                        <p style={{
                          color: '#1a202c',
                          fontWeight: '500',
                          fontSize: '14px',
                          marginBottom: '2px'
                        }}>
                          {pos.name}
                        </p>
                        {pos.description && (
                          <p style={{
                            color: '#718096',
                            fontSize: '12px'
                          }}>
                            {pos.description}
                          </p>
                        )}
                      </div>
                      <span style={{
                        background: '#eef2ff',
                        color: '#4f46e5',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {pos.quantity} {pos.unit}
                      </span>
                    </div>
                    {(pos.category || pos.otskp_code) && (
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        fontSize: '11px'
                      }}>
                        {pos.category && (
                          <span style={{
                            background: '#dbeafe',
                            color: '#0c4a6e',
                            padding: '2px 6px',
                            borderRadius: '3px'
                          }}>
                            {pos.category}
                          </span>
                        )}
                        {pos.otskp_code && (
                          <span style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '2px 6px',
                            borderRadius: '3px'
                          }}>
                            Code: {pos.otskp_code}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <div>
            {analysis.materials.length === 0 ? (
              <p style={{ color: '#718096', textAlign: 'center', padding: '20px 0' }}>
                No materials found in analysis
              </p>
            ) : (
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{
                    borderBottom: '2px solid #e2e8f0',
                    background: '#f9fafb'
                  }}>
                    <th style={{
                      padding: '10px',
                      textAlign: 'left',
                      color: '#4a5568',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      Material
                    </th>
                    <th style={{
                      padding: '10px',
                      textAlign: 'right',
                      color: '#4a5568',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      Quantity
                    </th>
                    <th style={{
                      padding: '10px',
                      textAlign: 'right',
                      color: '#4a5568',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      Unit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.materials.map((mat, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: idx % 2 === 0 ? '#f9fafb' : 'white'
                      }}
                    >
                      <td style={{
                        padding: '10px',
                        color: '#1a202c',
                        fontSize: '13px'
                      }}>
                        {mat.name}
                      </td>
                      <td style={{
                        padding: '10px',
                        textAlign: 'right',
                        color: '#1a202c',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}>
                        {mat.quantity.toFixed(2)}
                      </td>
                      <td style={{
                        padding: '10px',
                        textAlign: 'right',
                        color: '#718096',
                        fontSize: '12px'
                      }}>
                        {mat.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Dimensions Tab */}
        {activeTab === 'dimensions' && (
          <div>
            {Object.keys(analysis.dimensions).length === 0 ? (
              <p style={{ color: '#718096', textAlign: 'center', padding: '20px 0' }}>
                No dimensions extracted
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px'
              }}>
                {Object.entries(analysis.dimensions).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      padding: '12px',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <p style={{
                      color: '#718096',
                      fontSize: '12px',
                      textTransform: 'capitalize',
                      marginBottom: '4px'
                    }}>
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p style={{
                      color: '#1a202c',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Work list title input */}
      <div style={{
        padding: '20px',
        background: '#f7fafc',
        borderTop: '1px solid #e2e8f0'
      }}>
        <label style={{
          display: 'block',
          color: '#4a5568',
          fontSize: '13px',
          fontWeight: '500',
          marginBottom: '8px'
        }}>
          Work List Title (optional)
        </label>
        <input
          type="text"
          value={workListTitle}
          onChange={(e) => setWorkListTitle(e.target.value)}
          placeholder="e.g., Bridge Foundation Work"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Actions */}
      <div style={{
        padding: '16px 20px',
        background: 'white',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={onDelete}
          style={{
            padding: '10px 16px',
            background: '#fee2e2',
            color: '#991b1b',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s ease'
          }}
        >
          Delete
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirming}
          style={{
            padding: '10px 24px',
            background: confirming ? '#cbd5e0' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: confirming ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s ease'
          }}
        >
          {confirming ? 'Creating Work List...' : 'Confirm & Create Work List'}
        </button>
      </div>
    </div>
  );
}
