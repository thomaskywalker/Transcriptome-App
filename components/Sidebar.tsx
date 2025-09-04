
import React, { useState, useEffect } from 'react';
import DataUpload from './DataUpload';
import type { AnalysisType, GeneIdentifierType, GseaDatabase } from '../types';

interface SidebarProps {
  onCountMatrixUpload: (file: File) => void;
  onMetadataUpload: (file: File) => void;
  onRunPrimaryAnalysis: (comparisons: {A: string, B: string}[]) => void;
  // FIX: Corrected the type for `onRunSubsequentAnalysis` to be a specific union type, resolving a TypeScript error.
  onRunSubsequentAnalysis: (analysisType: 'summary' | 'volcano' | 'ma_plot' | 'heatmap') => void;
  onRunGsea: (database: GseaDatabase) => void;
  isDataLoaded: boolean;
  isDegComplete: boolean;
  isLoading: boolean;
  dataFileName: string;
  metadataFileName: string;
  onClearData: () => void;
  onClearMetadata: () => void;
  conditions: string[];
  geneIdType: GeneIdentifierType;
  originalGeneIdType: GeneIdentifierType;
  pValueThreshold: number;
  onPValueThresholdChange: (value: number) => void;
}

type ComparisonMode = 'pairwise' | 'one_vs_rest';

const AnalysisButton: React.FC<{
    onClick: () => void,
    disabled: boolean,
    title: string,
    description: string
}> = ({ onClick, disabled, title, description}) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left p-3 bg-gray-800/50 rounded-lg border border-gray-700 transition-all duration-200 ease-in-out hover:border-cyan-400 hover:bg-gray-700/70 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-700 disabled:hover:bg-gray-800/50"
    >
      <p className="font-semibold text-gray-100">{title}</p>
      <p className="text-sm text-gray-400">{description}</p>
    </button>
);

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { onRunSubsequentAnalysis, onRunGsea, isDegComplete, isLoading, conditions, originalGeneIdType, geneIdType } = props;
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('pairwise');
  const [conditionA, setConditionA] = useState<string>(''); // Baseline
  const [conditionB, setConditionB] = useState<string>(''); // Comparison

  useEffect(() => {
    if (conditions.length >= 1) {
      setConditionA(conditions[0]);
    } else {
      setConditionA('');
    }
    if (conditions.length >= 2) {
      setConditionB(conditions[1]);
    } else {
      setConditionB('');
    }
  }, [conditions]);
  
   useEffect(() => {
    // If only 2 conditions, force pairwise
    if (conditions.length <= 2) {
      setComparisonMode('pairwise');
    }
  }, [conditions]);

  const handleRunPrimaryAnalysis = () => {
    if (comparisonMode === 'pairwise') {
        if(conditionA && conditionB && conditionA !== conditionB) {
            props.onRunPrimaryAnalysis([{ A: conditionA, B: conditionB }]);
        }
    } else { // one_vs_rest
        if(conditionA) {
            const comparisons = conditions
                .filter(c => c !== conditionA)
                .map(c => ({ A: conditionA, B: c }));
            if (comparisons.length > 0) {
                 props.onRunPrimaryAnalysis(comparisons);
            }
        }
    }
  };

  const isPrimaryAnalysisDisabled = !props.isDataLoaded || isLoading || !conditionA || (comparisonMode === 'pairwise' && (!conditionB || conditionA === conditionB));
  const isSubsequentAnalysisDisabled = !isDegComplete || isLoading;

  const renderGeneIdMessage = () => {
    if (!props.dataFileName || originalGeneIdType === 'unknown') return null;

    let message;
    if (originalGeneIdType === 'symbol' && geneIdType === 'symbol') {
        message = <>Detected ID: <span className="font-semibold text-cyan-400 capitalize">Symbol</span></>;
    } else {
        message = <>Detected <span className="font-semibold text-cyan-400 capitalize">{originalGeneIdType}</span>, converted to <span className="font-semibold text-cyan-400 capitalize">Symbol</span></>;
    }

    return (
         <p className="text-xs text-center text-gray-400 bg-gray-800 py-1 rounded-md">{message}</p>
    )
  }

  return (
    <aside className="w-96 bg-gray-900/80 backdrop-blur-md border-r border-gray-700/50 p-6 flex flex-col space-y-6 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold text-cyan-400 mb-3">1. Load Data</h2>
        <div className="space-y-4">
            <DataUpload 
                onFileUpload={props.onCountMatrixUpload} 
                fileName={props.dataFileName} 
                onClearData={props.onClearData}
                label="Count Matrix"
                accept=".csv,.tsv,.txt"
            />
            {renderGeneIdMessage()}
            <DataUpload
                onFileUpload={props.onMetadataUpload}
                fileName={props.metadataFileName}
                onClearData={props.onClearMetadata}
                label="Sample Metadata"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
            />
        </div>
      </div>
       <div>
        <h2 className="text-lg font-semibold text-cyan-400 mb-3">2. Configure & Run</h2>
        <div className="space-y-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
            {conditions.length > 2 && (
                 <div>
                    <label className="text-sm font-medium text-gray-300">Comparison Mode</label>
                    <div className="flex items-center space-x-4 mt-2">
                        <label className="flex items-center text-sm text-gray-400"><input type="radio" name="comp-mode" value="pairwise" checked={comparisonMode === 'pairwise'} onChange={() => setComparisonMode('pairwise')} className="mr-2 bg-gray-700 text-cyan-500 focus:ring-cyan-500"/>Pairwise</label>
                        <label className="flex items-center text-sm text-gray-400"><input type="radio" name="comp-mode" value="one_vs_rest" checked={comparisonMode === 'one_vs_rest'} onChange={() => setComparisonMode('one_vs_rest')} className="mr-2 bg-gray-700 text-cyan-500 focus:ring-cyan-500"/>One vs. All</label>
                    </div>
                </div>
            )}
           
            <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label htmlFor="conditionA" className="block text-xs font-medium text-gray-400">Baseline (Control)</label>
                    <select id="conditionA" value={conditionA} onChange={e => setConditionA(e.target.value)} disabled={conditions.length === 0} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-900 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md text-white">
                        {conditions.map(c => <option key={`a-${c}`}>{c}</option>)}
                    </select>
                </div>
                {comparisonMode === 'pairwise' && (
                 <div>
                    <label htmlFor="conditionB" className="block text-xs font-medium text-gray-400">Comparison</label>
                    <select id="conditionB" value={conditionB} onChange={e => setConditionB(e.target.value)} disabled={conditions.length === 0} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-900 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md text-white">
                        {conditions.map(c => <option key={`b-${c}`}>{c}</option>)}
                    </select>
                </div>
                )}
            </div>

            <div>
                 <label htmlFor="pval-slider" className="block text-xs font-medium text-gray-400">Adj. P-Value Threshold: <span className="font-bold text-cyan-400">{props.pValueThreshold}</span></label>
                 <input id="pval-slider" type="range" min="0.001" max="1" step="0.001" value={props.pValueThreshold} onChange={e => props.onPValueThresholdChange(parseFloat(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-1" />
            </div>

            {comparisonMode === 'pairwise' && conditionA && conditionB && conditionA === conditionB && (
                <p className="text-xs text-red-400 text-center">Baseline and Comparison conditions must be different.</p>
            )}

            <button
                onClick={handleRunPrimaryAnalysis}
                disabled={isPrimaryAnalysisDisabled}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
                Run DESeq2 Analysis
            </button>
        </div>
      </div>


      <div className="flex-1 space-y-4">
        <h2 className="text-lg font-semibold text-cyan-400">3. Visualize & Interpret</h2>
        <p className={`text-sm text-gray-500 ${isDegComplete ? 'hidden' : 'block'}`}>Complete DESeq2 analysis to enable these options.</p>
        
        <details open className="space-y-3">
            <summary className="font-semibold text-gray-200 cursor-pointer">Overview & Plots</summary>
            <AnalysisButton onClick={() => onRunSubsequentAnalysis('summary')} disabled={isSubsequentAnalysisDisabled} title="AI Data Summary" description="Get a high-level overview of results."/>
            <AnalysisButton onClick={() => onRunSubsequentAnalysis('volcano')} disabled={isSubsequentAnalysisDisabled} title="Volcano Plot" description="Visualize significance vs. fold change."/>
            <AnalysisButton onClick={() => onRunSubsequentAnalysis('ma_plot')} disabled={isSubsequentAnalysisDisabled} title="MA Plot" description="Check for expression-dependent bias."/>
            <AnalysisButton onClick={() => onRunSubsequentAnalysis('heatmap')} disabled={isSubsequentAnalysisDisabled} title="DEG Heatmap" description="Visualize top changing genes."/>
        </details>

         <details open className="space-y-3">
            <summary className="font-semibold text-gray-200 cursor-pointer">Functional & Pathway Analysis</summary>
             <AnalysisButton onClick={() => onRunGsea('GO')} disabled={isSubsequentAnalysisDisabled} title="GSEA: Gene Ontology (BP)" description="Run GSEA on GO Biological Processes."/>
             <AnalysisButton onClick={() => onRunGsea('KEGG')} disabled={isSubsequentAnalysisDisabled} title="GSEA: KEGG Pathways" description="Run GSEA on the KEGG database."/>
        </details>
      </div>
      
    </aside>
  );
};

export default Sidebar;
