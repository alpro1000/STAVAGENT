'use client';

import React, { useState } from 'react';

interface DashboardExportProps {
  projectName: string;
  projectId: string;
}

export function DashboardExport({ projectName, projectId }: DashboardExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'email' | null>(null);

  const handleExport = async (format: 'pdf' | 'excel') => {
    setIsExporting(true);
    setExportFormat(format);

    try {
      console.log(`Exporting dashboard as ${format} for project ${projectId}`);

      // TODO: Implement actual export logic
      // For PDF: use jsPDF or react-to-pdf
      // For Excel: use xlsx library

      // Simulate export delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate download
      alert(`Dashboard exported as ${format.toUpperCase()}! (Implementation pending)`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  const handleEmail = async () => {
    setIsExporting(true);
    setExportFormat('email');

    try {
      console.log(`Sending dashboard report via email for project ${projectId}`);

      // TODO: Implement email functionality
      // Integrate with backend email service

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const email = prompt('Enter recipient email:');
      if (email) {
        alert(`Dashboard report will be sent to ${email} (Implementation pending)`);
      }
    } catch (error) {
      console.error('Email failed:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">📤 Export Dashboard</h4>

      <div className="grid grid-cols-3 gap-3">
        {/* Export to PDF */}
        <button
          onClick={() => handleExport('pdf')}
          disabled={isExporting}
          className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-3xl">📄</span>
          <span className="text-xs font-medium text-gray-700">Export PDF</span>
          {isExporting && exportFormat === 'pdf' && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </button>

        {/* Export to Excel */}
        <button
          onClick={() => handleExport('excel')}
          disabled={isExporting}
          className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-3xl">📊</span>
          <span className="text-xs font-medium text-gray-700">Export Excel</span>
          {isExporting && exportFormat === 'excel' && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </button>

        {/* Send via Email */}
        <button
          onClick={handleEmail}
          disabled={isExporting}
          className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-3xl">📧</span>
          <span className="text-xs font-medium text-gray-700">Email Report</span>
          {isExporting && exportFormat === 'email' && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Export includes all metrics, charts, and analysis
      </p>
    </div>
  );
}
