
import React, { useRef } from 'react';
import type { AnalysisResult, CountMatrix, GeneData, GseaDatabase, GseaResult } from '../types';
import LoadingSpinner from './LoadingSpinner';
import VolcanoPlot from './VolcanoPlot';
import GeneTable from './GeneTable';
import MAPlot from './MAPlot';
import Heatmap from './Heatmap';
import GseaDotPlot from './GseaDotPlot';
import { RService } from '../services/rService';
import { downloadExcel, downloadPlotPng } from '../utils/downloader';

interface ResultsDisplayProps {
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  result: AnalysisResult | null;
  data: GeneData[] | null;
  countMatrix: CountMatrix | null;
  rService: RService;
  comparisons: string[];
  currentComparison: string | null;
  onComparisonChange: (comparison: string) => void;
  gseaResults: { [key: string]: { [db in GseaDatabase]?: GseaResult[] } };
}

const DownloadIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);


const WelcomeMessage: React.FC = () => (
    <div className="text-center text-gray-400 p-8 border-2 border-dashed border-gray-700 rounded-xl">
        <h2 className="text-2xl font-bold text-gray-300 mb-2">Welcome to Transcriptome Analyst AI</h2>
        <p className="mb-4">Upload your data to begin analysis with DESeq2.</p>
        <div className="text-left max-w-2xl mx-auto space-y-3">
           <p><strong className="text-cyan-400">1. Count Matrix (Required):</strong> A CSV or TSV file.</p>
           <p className="text-sm ml-4 text-gray-500">
                The first column must be your gene identifiers (the app will attempt to convert them to symbols).
            </p>
             <p className="text-sm ml-4 text-gray-500">
                Subsequent columns should be your samples with their raw counts.
            </p>
            <p><strong className="text-cyan-400">2. Sample Metadata (Required):</strong> A CSV, TSV or Excel file.</p>
             <p className="text-sm ml-4 text-gray-500">
               Must contain a <code className="bg-gray-800 p-1 rounded">sample</code> column with names matching the count matrix, and a <code className="bg-ray-800 p-1 rounded">condition</code> column grouping your samples.
            </p>
        </div>
    </div>
);

const AnalysisResultContainer: React.FC<{title: string; children: React.ReactNode; onDownload?: () => void, downloadLabel?: string }> = ({ title, children, onDownload, downloadLabel }) => (
     <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700/50">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-cyan-400 capitalize">
                {title}
            </h2>
            {onDownload && (
                <button onClick={onDownload} className="flex items-center space-x-2 text-sm bg-gray-700 hover:bg-cyan-600 text-gray-200 font-semibold py-2 px-3 rounded-lg transition-colors">
                    <DownloadIcon className="h-4 w-4" />
                    <span>{downloadLabel || 'Download'}</span>
                </button>
            )}
        </div>
        {children}
    </div>
);

const ResultsDisplay: React.FC<ResultsDisplayProps> = (props) => {
  const { isLoading, loadingMessage, error, result, data, countMatrix, rService, comparisons, currentComparison, onComparisonChange, gseaResults } = props;
  const plotContainerRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return <LoadingSpinner message={loadingMessage} />;
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 text-red-300 p-4 rounded-lg animate-fade-in">
        <h3 className="font-bold">An Error Occurred</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!result || !data) {
    return <WelcomeMessage />;
  }
  
  const handleDownloadPlot = () => {
    const svg = plotContainerRef.current?.querySelector('svg');
    if (svg) {
        downloadPlotPng(svg, `${currentComparison}_${result.type}_plot`);
    }
  }

  const { type, text, significantGenes, gseaData } = result;
  
  const renderContent = () => {
    switch(type) {
        case 'summary':
            return (
                <AnalysisResultContainer title={"AI Analysis Summary"}>
                     <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 whitespace-pre-wrap">
                        {text}
                    </div>
                </AnalysisResultContainer>
            );
        
        case 'volcano':
             return (
                <>
                    <AnalysisResultContainer title="Volcano Plot" onDownload={handleDownloadPlot} downloadLabel="Download PNG">
                        <div ref={plotContainerRef}>
                            <VolcanoPlot data={data} />
                        </div>
                    </AnalysisResultContainer>
                </>
             );
        
        case 'ma_plot':
             return (
                <>
                    <AnalysisResultContainer title="MA Plot" onDownload={handleDownloadPlot} downloadLabel="Download PNG">
                         <div ref={plotContainerRef}>
                            <MAPlot data={data} />
                         </div>
                    </AnalysisResultContainer>
                </>
             );
        case 'heatmap':
            return (
                <>
                    <AnalysisResultContainer title="Top 40 Differentially Expressed Genes Heatmap">
                        {significantGenes && countMatrix && rService && (
                            <Heatmap 
                                up={significantGenes.up.slice(0, 20)} 
                                down={significantGenes.down.slice(0, 20)}
                                countMatrix={countMatrix}
                                rService={rService}
                            />
                        )}
                    </AnalysisResultContainer>
                </>
            );
        
        case 'gsea':
            if (!gseaData || !currentComparison) return null;
            const handleGseaDownload = () => downloadExcel(gseaData.results, `${currentComparison}_GSEA_${gseaData.db}_results`);
             return (
                <AnalysisResultContainer title={`GSEA Results: ${gseaData.db}`} onDownload={handleGseaDownload} downloadLabel="Download Excel">
                    <div ref={plotContainerRef}>
                        <GseaDotPlot data={gseaData.results} />
                    </div>
                    <div className="mt-4 flex justify-end">
                         <button onClick={handleDownloadPlot} className="flex items-center space-x-2 text-sm bg-gray-700 hover:bg-cyan-600 text-gray-200 font-semibold py-2 px-3 rounded-lg transition-colors">
                            <DownloadIcon className="h-4 w-4" />
                            <span>Download Plot (PNG)</span>
                        </button>
                    </div>
                </AnalysisResultContainer>
             )

        default:
            return null;
    }
  }


  return (
    <div className="space-y-8 animate-fade-in">
        {comparisons.length > 1 && (
            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 flex items-center space-x-4">
                <label htmlFor="comparison-select" className="font-semibold text-gray-200">Current Comparison:</label>
                <select 
                    id="comparison-select"
                    value={currentComparison || ''}
                    onChange={(e) => onComparisonChange(e.target.value)}
                    className="block w-full max-w-xs pl-3 pr-10 py-2 text-base bg-gray-900 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md text-white"
                >
                    {comparisons.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        )}

       {renderContent()}
        
        {significantGenes && (type === 'summary' || type === 'volcano' || type === 'ma_plot') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnalysisResultContainer title="Top Up-Regulated Genes" onDownload={() => downloadExcel(significantGenes.up, `${currentComparison}_up_regulated_genes`)} downloadLabel="Download Excel">
                    <GeneTable genes={significantGenes.up.slice(0, 10)} />
                </AnalysisResultContainer>
                 <AnalysisResultContainer title="Top Down-Regulated Genes" onDownload={() => downloadExcel(significantGenes.down, `${currentComparison}_down_regulated_genes`)} downloadLabel="Download Excel">
                    <GeneTable genes={significantGenes.down.slice(0, 10)} />
                </AnalysisResultContainer>
            </div>
        )}
    </div>
  );
};

export default ResultsDisplay;
