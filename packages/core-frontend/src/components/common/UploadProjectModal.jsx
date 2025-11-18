import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';

export default function UploadProjectModal({ isOpen, onClose, onUpload }) {
  const [projectName, setProjectName] = useState('');
  const [workflow, setWorkflow] = useState('A');
  const [files, setFiles] = useState([]);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = () => {
    if (!projectName.trim() || files.length === 0) {
      alert('Zadejte název projektu a vyberte soubory');
      return;
    }
    onUpload({ projectName: projectName.trim(), workflow, files });
    handleClose();
  };

  const handleClose = () => {
    setProjectName('');
    setWorkflow('A');
    setFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Nahrát nový projekt</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded transition"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Název projektu *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Most přes řeku"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow
            </label>
            <select
              value={workflow}
              onChange={(e) => setWorkflow(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            >
              <option value="A">Workflow A - Výkaz výměr + Výkresy</option>
              <option value="B">Workflow B - Pouze výkresy</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Soubory *
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.dwg"
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Podporované formáty: PDF, XLSX, XLS, PNG, JPG, DWG
            </p>
            {files.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                Vybráno: {files.length} souborů
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={!projectName.trim() || files.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            <Upload size={18} /> Nahrát
          </button>
        </div>
      </div>
    </div>
  );
}
