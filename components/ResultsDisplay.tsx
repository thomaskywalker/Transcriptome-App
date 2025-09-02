import React from 'react';
import type { AnalysisResult, CountMatrix, GeneData } from '../types';
import LoadingSpinner from './LoadingSpinner';
import VolcanoPlot from './VolcanoPlot';
import GeneTable from './GeneTable';
import MAPlot from './MAPlot';
import Heatmap from './Heatmap';
import { RService } from '../services/rService';

interface ResultsDisplayProps {
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  result: AnalysisResult | null;
  data: GeneData[] | null;
  countMatrix: CountMatrix | null;
  rService: RService;
}

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

const AnalysisResultContainer: React.FC<{title: string; children: React.ReactNode}> = ({ title, children }) => (
     <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700/50">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4 capitalize">
            {title}
        </h2>
        {children}
    </div>
);

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ isLoading, loadingMessage, error, result, data, countMatrix, rService }) => {
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

  const { type, text, significantGenes } = result;
  
  const renderContent = () => {
    switch(type) {
        case 'summary':
        case 'pathway':
            return (
                <AnalysisResultContainer title={type === 'summary' ? "AI Analysis Summary" : "Pathway Interpretation"}>
                     <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 whitespace-pre-wrap">
                        {text}
                    </div>
                </AnalysisResultContainer>
            );
        
        case 'volcano':
             return (
                <>
                    <AnalysisResultContainer title="Volcano Plot">
                        <VolcanoPlot data={data} />
                    </AnalysisResultContainer>
                     {text && (
                        <AnalysisResultContainer title="AI Interpretation">
                            <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 whitespace-pre-wrap">
                                {text}
                            </div>
                        </AnalysisResultContainer>
                    )}
                </>
             );
        
        case 'ma_plot':
             return (
                <>
                    <AnalysisResultContainer title="MA Plot">
                        <MAPlot data={data} />
                    </AnalysisResultContainer>
                    {text && (
                        <AnalysisResultContainer title="AI Interpretation">
                            <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 whitespace-pre-wrap">
                                {text}
                            </div>
                        </AnalysisResultContainer>
                    )}
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
                    {text && (
                        <AnalysisResultContainer title="AI Interpretation">
                            <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 whitespace-pre-wrap">
                            {text}
                            </div>
                        </AnalysisResultContainer>
                    )}
                </>
            )

        default:
            return null;
    }
  }


  return (
    <div className="space-y-8 animate-fade-in">
       {renderContent()}
        
        {significantGenes && (type === 'summary' || type === 'volcano' || type === 'ma_plot' || type === 'pathway') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnalysisResultContainer title="Top 10 Up-Regulated Genes">
                    <GeneTable genes={significantGenes.up.slice(0, 10)} />
                </AnalysisResultContainer>
                 <AnalysisResultContainer title="Top 10 Down-Regulated Genes">
                    <GeneTable genes={significantGenes.down.slice(0, 10)} />
                </AnalysisResultContainer>
            </div>
        )}
    </div>
  );
};

export default ResultsDisplay;