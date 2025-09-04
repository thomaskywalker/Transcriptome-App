
import React from 'react';

const DnaIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M14.5 14.5c-1-1-2-2-2-4s1-3 2-4"/><path d="M9.5 9.5c1 1 2 2 2 4s-1 3-2 4"/>
        <path d="M12 2v20"/><path d="M4.5 4.5 2 7l2.5 2.5"/><path d="M19.5 19.5 22 17l-2.5-2.5"/>
    </svg>
);

const TerminalIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
);


interface HeaderProps {
    onToggleRConsole: () => void;
}

const Header: React.FC<HeaderProps> = ({ onToggleRConsole }) => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center">
            <DnaIcon className="text-cyan-400 h-8 w-8 mr-3" />
            <h1 className="text-2xl font-bold text-white tracking-wider">
                Transcriptome <span className="text-cyan-400">Analyst AI</span>
            </h1>
        </div>
        <button 
            onClick={onToggleRConsole}
            className="text-gray-400 hover:text-cyan-400 transition-colors"
            aria-label="Toggle R Console"
            title="Toggle R Console"
        >
            <TerminalIcon className="h-6 w-6" />
        </button>
    </header>
  );
};

export default Header;
