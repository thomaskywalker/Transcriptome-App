import React, { useRef } from 'react';

interface DataUploadProps {
  onFileUpload: (file: File) => void;
  fileName: string;
  onClearData: () => void;
  label: string;
  accept: string;
}

const FileIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
);

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
);

const DataUpload: React.FC<DataUploadProps> = ({ onFileUpload, fileName, onClearData, label, accept }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
     // Reset the input value to allow re-uploading the same file
    if(event.target) {
        event.target.value = '';
    }
  };
  
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
        <label className="text-sm font-medium text-gray-400 mb-2 block">{label}</label>
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept={accept}
        />
        {!fileName ? (
            <button
            onClick={handleButtonClick}
            className="w-full bg-gray-700 hover:bg-cyan-500 hover:text-gray-900 text-gray-200 font-semibold py-2 px-4 border border-gray-600 rounded-lg shadow-md transition-all duration-300 ease-in-out flex items-center justify-center"
            >
            <FileIcon className="h-5 w-5 mr-2" />
            Upload File
            </button>
        ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center overflow-hidden">
                <FileIcon className="h-5 w-5 mr-2 text-cyan-400 flex-shrink-0" />
                <span className="text-sm text-gray-300 truncate" title={fileName}>{fileName}</span>
                </div>
            <button onClick={onClearData} className="text-gray-500 hover:text-red-500 ml-2 flex-shrink-0">
                <TrashIcon className="h-5 w-5" />
            </button>
            </div>
        )}
    </div>
  );
};

export default DataUpload;
