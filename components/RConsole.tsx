
import React, { useEffect, useRef } from 'react';

interface RConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  logs: string;
}

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

const RConsole: React.FC<RConsoleProps> = ({ isOpen, onClose, logs }) => {
  const consoleBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to the bottom when new logs are added
    if (consoleBodyRef.current) {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-1/3 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700 shadow-2xl z-50 flex flex-col animate-fade-in-up">
      <div className="flex justify-between items-center p-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <h3 className="font-mono text-sm font-bold text-cyan-400">R CONSOLE</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
      <div ref={consoleBodyRef} className="flex-1 p-2 overflow-y-auto">
        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words">
          {logs}
        </pre>
      </div>
    </div>
  );
};

export default RConsole;
