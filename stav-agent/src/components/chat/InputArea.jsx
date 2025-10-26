import React, { useState, useEffect } from 'react';
import { Send, Upload, X } from 'lucide-react';

export default function InputArea({ onSend, onUpload, isLoading, uploadProgress }) {
  const [input, setInput] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (showUpload && typeof onUpload === 'function') {
      onUpload();
    }
  }, [showUpload, onUpload]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white border-t border-gray-200">
      {showUpload && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <div className="text-sm text-blue-700">
            {uploadProgress !== null ? `Nahrávám... ${uploadProgress}%` : 'Vyber soubory k nahrání'}
          </div>
          <button
            onClick={() => setShowUpload(false)}
            className="p-1 hover:bg-blue-200 rounded transition"
          >
            <X size={16} className="text-blue-600" />
          </button>
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Napiš otázku nebo popis úkolu... (Shift+Enter pro řádek)"
            disabled={isLoading}
            rows="2"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 disabled:bg-gray-100 resize-none"
          />

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
              title="Odeslat"
            >
              <Send size={20} />
            </button>

            <button
              onClick={() => setShowUpload((prev) => !prev)}
              disabled={isLoading}
              className="border border-gray-300 text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              title="Nahrát soubory"
            >
              <Upload size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
