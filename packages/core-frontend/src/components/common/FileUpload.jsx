import React, { useRef } from 'react';

export default function FileUpload({ onFilesSelected, accept = '.xlsx,.xls,.csv,.pdf' }) {
  const inputRef = useRef(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length && onFilesSelected) {
      onFilesSelected(files);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition"
      >
        Nahraj soubory nebo je přetáhni sem
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </>
  );
}
