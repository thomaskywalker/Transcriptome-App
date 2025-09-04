
export interface GeneData {
  gene: string;
  log2FoldChange: number;
  pvalue: number; // Note: This will be the adjusted p-value (padj) from DESeq2
  negLog10PValue: number;
  averageExpression?: number; // Note: This will be the baseMean from DESeq2
}

export type AnalysisType = 'summary' | 'volcano' | 'ma_plot' | 'heatmap' | 'gsea';

export type ClusteringMethod = 'ward.D2' | 'complete' | 'average' | 'single';

export interface GseaResult {
    ID: string;
    Description: string;
    setSize: number;
    enrichmentScore: number;
    NES: number;
    pvalue: number;
    'p.adjust': number;
    core_enrichment: string;
}

export type GseaDatabase = 'GO' | 'KEGG';

export interface AnalysisResult {
    type: AnalysisType;
    text: string;
    significantGenes?: {
        up: GeneData[];
        down: GeneData[];
    };
    gseaData?: {
        db: GseaDatabase;
        results: GseaResult[];
    }
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
