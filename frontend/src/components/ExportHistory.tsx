/**
 * ExportHistory component - Display and manage saved exports
 */

import { useExports } from '../hooks/useExports';

interface ExportHistoryProps {
  onClose: () => void;
}

export default function ExportHistory({ onClose }: ExportHistoryProps) {
  const { exports, isLoading, downloadExport, isDownloading, deleteExport, isDeleting } = useExports();

  const handleDownload = (filename: string) => {
    try {
      downloadExport(filename);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Chyba při stahování: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  };

  const handleDelete = (filename: string) => {
    if (window.confirm(`Chcete smazat ${filename}?`)) {
      try {
        deleteExport(filename);
      } catch (error) {
        console.error('Delete error:', error);
        alert(`Chyba při mazání: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      }
    }
  };

  return (
    <div className="export-history-modal">
      <div className="export-history-content">
        <div className="export-history-header">
          <h2>📋 Historie exportů</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="export-history-body">
          {isLoading ? (
            <div className="loading">Načítám historii exportů...</div>
          ) : exports.length === 0 ? (
            <div className="empty-state">
              <p>Žádné uložené exporty</p>
              <p className="hint">Použijte tlačítko "Uložit na server" pro uložení exportů</p>
            </div>
          ) : (
            <table className="exports-table">
              <thead>
                <tr>
                  <th>Most</th>
                  <th>Čas vytvoření</th>
                  <th>Velikost</th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((exp) => (
                  <tr key={exp.filename}>
                    <td className="export-bridge">{exp.bridge_id}</td>
                    <td className="export-date">{exp.created_at}</td>
                    <td className="export-size">{exp.size} KB</td>
                    <td className="export-actions">
                      <button
                        className="btn-small btn-success"
                        onClick={() => handleDownload(exp.filename)}
                        disabled={isDownloading}
                        title="Stáhnout soubor"
                      >
                        ⬇️ Stáhnout
                      </button>
                      <button
                        className="btn-small btn-danger"
                        onClick={() => handleDelete(exp.filename)}
                        disabled={isDeleting}
                        title="Smazat soubor"
                      >
                        🗑️ Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
