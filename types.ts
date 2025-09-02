export interface GeneData {
  gene: string;
  log2FoldChange: number;
  pvalue: number; // Note: This will be the adjusted p-value (padj) from DESeq2
  negLog10PValue: number;
  averageExpression?: number; // Note: This will be the baseMean from DESeq2
}

export type AnalysisType = 'summary' | 'pathway' | 'volcano' | 'ma_plot' | 'heatmap';

export type ClusteringMethod = 'ward.D2' | 'complete' | 'average' | 'single';

export interface AnalysisResult {
    type: AnalysisType;
    text: string;
    significantGenes?: {
        up: GeneData[];
        down: GeneData[];
    };
}

export type GeneIdentifierType = 'symbol' | 'ensembl' | 'entrez' | 'uniprot' | 'unknown';

export type CountMatrix = {
    // gene identifier -> { sample_name -> count }
    [key: string]: { [key: string]: number };
};

export type SampleMetadata = {
    // sample_name -> condition
    [key: string]: string;
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}