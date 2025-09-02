
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


const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center shadow-lg">
        <DnaIcon className="text-cyan-400 h-8 w-8 mr-3" />
        <h1 className="text-2xl font-bold text-white tracking-wider">
            Transcriptome <span className="text-cyan-400">Analyst AI</span>
        </h1>
    </header>
  );
};

export default Header;
