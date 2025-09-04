
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ResultsDisplay from './components/ResultsDisplay';
import Header from './components/Header';
import Chatbot from './components/Chatbot';
import RConsole from './components/RConsole';
import type { AnalysisType, AnalysisResult, GeneData, SampleMetadata, GeneIdentifierType, CountMatrix, GseaResult, GseaDatabase } from './types';
import { parseCountMatrix, parseTextMetadata, parseExcelMetadata, convertIdsToSymbols, remapMatrixToSymbols } from './utils/parser';
import { getAnalysisFromGemini, resetChat } from './services/geminiService';
import { RService } from './services/rService';

const rService = new RService();

const App: React.FC = () => {
  // Input data state
  const [countMatrix, setCountMatrix] = useState<CountMatrix | null>(null);
  const [sampleMetadata, setSampleMetadata] = useState<SampleMetadata | null>(null);
  const [geneIdType, setGeneIdType] = useState<GeneIdentifierType>('unknown');
  const [originalGeneIdType, setOriginalGeneIdType] = useState<GeneIdentifierType>('unknown');

  // UI State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [dataFileName, setDataFileName] = useState<string>('');
  const [metadataFileName, setMetadataFileName] = useState<string>('');
  
  // R Service State
  const [isRReady, setIsRReady] = useState(false);
  const [isRConsoleOpen, setIsRConsoleOpen] = useState(false);
  const [rConsoleLogs, setRConsoleLogs] = useState<string>('');
  
  const handleRLog = useCallback((log: string) => {
    setRConsoleLogs(prev => prev + log);
  }, []);

  // Analysis state
  const [degResults, setDegResults] = useState<{ [key: string]: GeneData[] } | null>(null);
  const [gseaResults, setGseaResults] = useState<{ [key: string]: { [db in GseaDatabase]?: GseaResult[] } }>({});
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [currentComparison, setCurrentComparison] = useState<string | null>(null);
  
  // User Configuration
  const [pValueThreshold, setPValueThreshold] = useState<number>(0.05);

  useEffect(() => {
    const initializeR = async () => {
        setIsLoading(true);
        setLoadingMessage('Initializing R environment...');
        try {
            await rService.init(
                (msg: string) => setLoadingMessage(msg),
                handleRLog
            );
            setIsRReady(true);
        } catch (e: any) {
            setError(`Failed to initialize R environment: ${e.message}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    initializeR();
  }, [handleRLog]);


  const conditions = useMemo(() => {
    if (!sampleMetadata) return [];
    return [...new Set(Object.values(sampleMetadata))];
  }, [sampleMetadata]);

  const comparisons = useMemo(() => {
    return degResults ? Object.keys(degResults) : [];
  }, [degResults]);

  const handleCountMatrixUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Parsing count matrix...');
    setError(null);
    setCountMatrix(null);
    setDegResults(null);
    setCurrentAnalysis(null);
    setDataFileName(file.name);
    setCurrentComparison(null);
    setGseaResults({});

    try {
        const text = await file.text();
        let { matrix, identifierType } = parseCountMatrix(text);

        if (Object.keys(matrix).length === 0) {
          throw new Error("Failed to parse file. Ensure it's a valid CSV/TSV with a gene identifier column and sample columns.");
        }
        
        setOriginalGeneIdType(identifierType);
        
        if (identifierType !== 'symbol' && identifierType !== 'unknown') {
            setLoadingMessage(`Converting ${identifierType} IDs to symbols...`);
            const geneIds = Object.keys(matrix);
            const conversionMap = await convertIdsToSymbols(geneIds, identifierType);
            matrix = remapMatrixToSymbols(matrix, conversionMap);
            identifierType = 'symbol';
             if (Object.keys(matrix).length === 0) {
              throw new Error("No gene identifiers could be converted to symbols. Please check your ID format.");
            }
        }

        setCountMatrix(matrix);
        setGeneIdType(identifierType);
    } catch (e: any) {
        setError(e.message);
        setDataFileName('');
    } finally {
        setIsLoading(false);
    }
  }, []);


  const handleMetadataUpload = (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Parsing metadata...');
    setError(null);
    setSampleMetadata(null);
    setDegResults(null);
    setCurrentAnalysis(null);
    setMetadataFileName(file.name);
    setCurrentComparison(null);
    setGseaResults({});

    const reader = new FileReader();
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    reader.onload = (event) => {
      try {
        let parsedData: SampleMetadata;
        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            const buffer = event.target?.result as ArrayBuffer;
            parsedData = parseExcelMetadata(buffer);
        } else {
            const text = event.target?.result as string;
            parsedData = parseTextMetadata(text);
        }
         if (Object.keys(parsedData).length === 0) {
          throw new Error("Failed to parse metadata. Ensure it's a valid file with 'sample' and 'condition' columns and at least one data row.");
        }
        setSampleMetadata(parsedData);
      } catch (e: any) {
        setError(e.message);
        setMetadataFileName('');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the metadata file.');
      setIsLoading(false);
      setMetadataFileName('');
    };
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
  };

  const handlePrimaryAnalysis = useCallback(async (comparisonsToRun: {A: string, B: string}[]) => {
    if (!countMatrix || !sampleMetadata) {
      setError('Count matrix and metadata are required for analysis.');
      return;
    }
     if (!isRReady) {
        setError('The R environment is still being set up. Please try again in a moment.');
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setDegResults(null);
    setCurrentAnalysis(null);
    setCurrentComparison(null);
    setGseaResults({});

    const allResults: { [key: string]: GeneData[] } = {};
    
    try {
        for (const comp of comparisonsToRun) {
            const comparisonName = `${comp.B}_vs_${comp.A}`;
            setLoadingMessage(`Running DESeq2 for ${comparisonName}...`);
            const results = await rService.runDeseq2(countMatrix, sampleMetadata, comp.A, comp.B);
            allResults[comparisonName] = results;
        }

        setDegResults(allResults);
        const firstComparison = Object.keys(allResults)[0];
        setCurrentComparison(firstComparison);

        // After all DEG runs, get an AI summary for the first one
        setLoadingMessage('Getting AI interpretation...');
        const summaryResult = await getAnalysisFromGemini('summary', allResults[firstComparison], pValueThreshold);
        setCurrentAnalysis(summaryResult);

    } catch (e: any) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [countMatrix, sampleMetadata, isRReady, pValueThreshold]);


  // FIX: Replaced the incorrect `Omit<AnalysisType, 'pathway'>` with a more specific union type to fix the TypeScript error.
  const handleSubsequentAnalysis = useCallback(async (analysisType: 'summary' | 'volcano' | 'ma_plot' | 'heatmap') => {
    if (!degResults || !currentComparison) {
      setError('Please run the primary Differential Expression Analysis first.');
      return;
    }
    const currentData = degResults[currentComparison];
    
    if (analysisType === 'volcano' || analysisType === 'ma_plot' || analysisType === 'heatmap') {
         if (analysisType === 'ma_plot' && (!currentData[0].averageExpression || isNaN(currentData[0].averageExpression))) {
            setError("MA Plot requires an 'averageExpression' or 'baseMean' value, which was not found in the DESeq2 results.");
            return;
        }
        setCurrentAnalysis({
            type: analysisType,
            text: currentAnalysis?.text ?? '',
            significantGenes: currentAnalysis?.significantGenes
        });
        return;
    }


    setIsLoading(true);
    setLoadingMessage(`Getting AI interpretation for ${analysisType}...`);
    setError(null);
    
    try {
      const result = await getAnalysisFromGemini(analysisType, currentData, pValueThreshold);
      setCurrentAnalysis(result);
    } catch (e: any) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [degResults, currentAnalysis, currentComparison, pValueThreshold]);
  
  const handleGseaAnalysis = useCallback(async (db: GseaDatabase) => {
     if (!degResults || !currentComparison) {
      setError('Please run the primary Differential Expression Analysis first.');
      return;
    }
    // Check cache first
    if(gseaResults[currentComparison] && gseaResults[currentComparison][db]) {
        setCurrentAnalysis({
            type: 'gsea',
            text: '',
            gseaData: { db, results: gseaResults[currentComparison][db]! }
        });
        return;
    }

    setIsLoading(true);
    setLoadingMessage(`Running GSEA with ${db} database...`);
    setError(null);
    
    try {
        const currentData = degResults[currentComparison];
        const results = await rService.runGsea(currentData, db);

        setGseaResults(prev => ({
            ...prev,
            [currentComparison]: {
                ...prev[currentComparison],
                [db]: results,
            }
        }));

        setCurrentAnalysis({
            type: 'gsea',
            text: '',
            gseaData: { db, results }
        });

    } catch (e: any) {
        setError(`GSEA analysis failed: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  }, [degResults, currentComparison, gseaResults]);

  const clearData = () => {
    setCountMatrix(null);
    setCurrentAnalysis(null);
    setDegResults(null);
    setError(null);
    setDataFileName('');
    setGeneIdType('unknown');
    setOriginalGeneIdType('unknown');
    setCurrentComparison(null);
    setGseaResults({});
    resetChat();
  };

  const clearMetadata = () => {
    setSampleMetadata(null);
    setCurrentAnalysis(null);
    setDegResults(null);
    setMetadataFileName('');
    setCurrentComparison(null);
    setGseaResults({});
    resetChat();
  }

  const currentDegData = currentComparison && degResults ? degResults[currentComparison] : null;

  return (
    <div className="flex flex-col h-screen bg-gray-900 font-sans">
      <Header onToggleRConsole={() => setIsRConsoleOpen(!isRConsoleOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          onCountMatrixUpload={handleCountMatrixUpload} 
          onMetadataUpload={handleMetadataUpload}
          onRunPrimaryAnalysis={handlePrimaryAnalysis}
          onRunSubsequentAnalysis={handleSubsequentAnalysis}
          onRunGsea={handleGseaAnalysis}
          isDataLoaded={!!countMatrix && !!sampleMetadata}
          isDegComplete={!!degResults}
          isLoading={isLoading || !isRReady}
          dataFileName={dataFileName}
          metadataFileName={metadataFileName}
          onClearData={clearData}
          onClearMetadata={clearMetadata}
          conditions={conditions}
          geneIdType={geneIdType}
          originalGeneIdType={originalGeneIdType}
          pValueThreshold={pValueThreshold}
          onPValueThresholdChange={setPValueThreshold}
        />
        <main className="flex-1 p-6 overflow-y-auto">
          <ResultsDisplay
            isLoading={isLoading || !isRReady}
            loadingMessage={loadingMessage}
            error={error}
            result={currentAnalysis}
            data={currentDegData}
            countMatrix={countMatrix}
            rService={rService}
            comparisons={comparisons}
            currentComparison={currentComparison}
            onComparisonChange={setCurrentComparison}
            gseaResults={gseaResults}
          />
        </main>
      </div>
      {currentDegData && <Chatbot degResults={currentDegData} pValueThreshold={pValueThreshold}/>}
      <RConsole 
        isOpen={isRConsoleOpen}
        onClose={() => setIsRConsoleOpen(false)}
        logs={rConsoleLogs}
      />
    </div>
  );
};

export default App;
