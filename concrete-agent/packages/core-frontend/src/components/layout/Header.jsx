import React from 'react';
import { Upload, Settings, LogOut, Menu } from 'lucide-react';

const STATUS_COLOR_MAP = {
  AUDITED: 'bg-green-100 text-green-700 border-green-200',
  UPLOADED: 'bg-blue-100 text-blue-700 border-blue-200',
  PROCESSING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  ERROR: 'bg-red-100 text-red-700 border-red-200',
};

export default function Header({ onUploadProject, onToggleSidebar, currentProject, projectStatus, onHomeClick }) {
  const projectName = currentProject?.name || currentProject?.project_name;
  const normalizedStatus = projectStatus?.toUpperCase();
  const statusClasses =
    STATUS_COLOR_MAP[normalizedStatus] || 'bg-gray-100 text-gray-600 border-gray-200';

  const handleHomeClick = () => {
    if (onHomeClick) {
      onHomeClick();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-lg transition lg:hidden"
          type="button"
        >
          <Menu size={20} className="text-gray-600" />
        </button>
        <h1
          onClick={handleHomeClick}
          className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition"
        >
          🏗️ Stav Agent
        </h1>
        {projectName && (
          <span className="text-sm text-gray-500 ml-2 truncate max-w-[12rem] sm:max-w-[16rem]">
            / {projectName}
          </span>
        )}
        {projectStatus && (
          <span
            className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded border ${statusClasses}`}
          >
            {projectStatus}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onUploadProject}
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          type="button"
        >
          <Upload size={18} /> Nahrát projekt
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-lg transition" title="Nastavení" type="button">
          <Settings size={20} className="text-gray-600" />
        </button>

        <button className="p-2 hover:bg-gray-100 rounded-lg transition" title="Odhlásit se" type="button">
          <LogOut size={20} className="text-gray-600" />
        </button>
      </div>
    </header>
  );
}
