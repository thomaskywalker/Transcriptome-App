
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ResultsDisplay from './components/ResultsDisplay';
import Header from './components/Header';
import Chatbot from './components/Chatbot';
import type { AnalysisType, AnalysisResult, GeneData, SampleMetadata, GeneIdentifierType, CountMatrix } from './types';
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

  // Analysis state
  const [degResults, setDegResults] = useState<GeneData[] | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    const initializeR = async () => {
        setIsLoading(true);
        setLoadingMessage('Initializing R environment...');
        try {
            await rService.init((msg: string) => setLoadingMessage(msg));
            setIsRReady(true);
        } catch (e: any) {
            setError(`Failed to initialize R environment: ${e.message}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };
    initializeR();
  }, []);


  const conditions = useMemo(() => {
    if (!sampleMetadata) return [];
    return [...new Set(Object.values(sampleMetadata))];
  }, [sampleMetadata]);

  const handleCountMatrixUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Parsing count matrix...');
    setError(null);
    setCountMatrix(null);
    setDegResults(null);
    setCurrentAnalysis(null);
    setDataFileName(file.name);

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

  const handlePrimaryAnalysis = useCallback(async (conditionA: string, conditionB: string) => {
    if (!countMatrix || !sampleMetadata) {
      setError('Count matrix and metadata are required for analysis.');
      return;
    }
     if (!isRReady) {
        setError('The R environment is still being set up. Please try again in a moment.');
        return;
    }
    
    setIsLoading(true);
    setLoadingMessage('Running DESeq2 analysis in R...');
    setError(null);
    setDegResults(null);
    setCurrentAnalysis(null);

    try {
      const results = await rService.runDeseq2(countMatrix, sampleMetadata, conditionA, conditionB);
      setDegResults(results);

      // After DEG, immediately get an AI summary
      setLoadingMessage('Getting AI interpretation...');
      const summaryResult = await getAnalysisFromGemini('summary', results);
      setCurrentAnalysis(summaryResult);

    } catch (e: any) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [countMatrix, sampleMetadata, isRReady]);

  const handleSubsequentAnalysis = useCallback(async (analysisType: AnalysisType) => {
    if (!degResults) {
      setError('Please run the primary Differential Expression Analysis first.');
      return;
    }
    
    // For plots, we don't need a new AI call, just set the type to render
    if (analysisType === 'volcano' || analysisType === 'ma_plot' || analysisType === 'heatmap') {
         if (analysisType === 'ma_plot' && (!degResults[0].averageExpression || isNaN(degResults[0].averageExpression))) {
            setError("MA Plot requires an 'averageExpression' or 'baseMean' value, which was not found in the DESeq2 results.");
            return;
        }
        setCurrentAnalysis({
            type: analysisType,
            text: currentAnalysis?.text ?? '', // Keep previous interpretation if available
            significantGenes: currentAnalysis?.significantGenes
        });
        return;
    }


    setIsLoading(true);
    setLoadingMessage(`Getting AI interpretation for ${analysisType}...`);
    setError(null);
    
    try {
      const result = await getAnalysisFromGemini(analysisType, degResults);
      setCurrentAnalysis(result);
// FIX: A typo 'S' was replaced with '{' to correctly form the catch block.
    } catch (e: any) {
      setError(`Analysis failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [degResults, currentAnalysis]);


  const clearData = () => {
    setCountMatrix(null);
    setCurrentAnalysis(null);
    setDegResults(null);
    setError(null);
    setDataFileName('');
    setGeneIdType('unknown');
    setOriginalGeneIdType('unknown');
    resetChat();
  };

  const clearMetadata = () => {
    setSampleMetadata(null);
    setCurrentAnalysis(null);
    setDegResults(null);
    setMetadataFileName('');
    resetChat();
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          onCountMatrixUpload={handleCountMatrixUpload} 
          onMetadataUpload={handleMetadataUpload}
          onRunPrimaryAnalysis={handlePrimaryAnalysis}
          onRunSubsequentAnalysis={handleSubsequentAnalysis}
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
        />
        <main className="flex-1 p-6 overflow-y-auto">
          <ResultsDisplay
            isLoading={isLoading || !isRReady}
            loadingMessage={loadingMessage}
            error={error}
            result={currentAnalysis}
            data={degResults}
            countMatrix={countMatrix}
            rService={rService}
          />
        </main>
      </div>
      {degResults && <Chatbot degResults={degResults} />}
    </div>
  );
};

export default App;
