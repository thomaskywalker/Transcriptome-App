import type { CountMatrix, SampleMetadata, GeneData, ClusteringMethod } from '../types';

declare const webR: any;

export class RService {
    private webR: any;
    private isInitialized: boolean = false;
    private isInstalling: boolean = false;

    async init(logCallback: (msg: string) => void) {
        if (this.isInitialized) return;
        
        logCallback('Initializing R environment (this may take a moment)...');
        this.webR = new webR.WebR();
        await this.webR.init();
        this.isInitialized = true;
        logCallback('R environment ready.');
        
        // Start installing packages in the background, don't block
        this.installPackages(logCallback);
    }

    private async installPackages(logCallback: (msg: string) => void) {
        if (this.isInstalling) return;
        this.isInstalling = true;

        try {
            logCallback('Installing BiocManager...');
            await this.webR.evalR('if (!requireNamespace("BiocManager", quietly = TRUE)) install.packages("BiocManager")');

            logCallback('Installing DESeq2 (this is a one-time setup and can take several minutes)...');
            await this.webR.evalR('if (!requireNamespace("DESeq2", quietly = TRUE)) BiocManager::install("DESeq2", update=FALSE)');
            
            logCallback('Packages installed successfully.');
        } catch (e) {
            console.error("Error installing R packages:", e);
            logCallback('Error installing R packages. Analysis may fail.');
        } finally {
            this.isInstalling = false;
        }
    }

    async runDeseq2(
        matrix: CountMatrix,
        metadata: SampleMetadata,
        conditionA: string,
        conditionB: string
    ): Promise<GeneData[]> {
        if (!this.isInitialized) throw new Error("R service not initialized.");

        // Wait for installation to finish if it's in progress
        while (this.isInstalling) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Convert JS objects to R-readable formats
        const genes = Object.keys(matrix);
        const samples = Object.keys(metadata);
        
        // Create the count matrix string for R
        const countMatrixString = genes.map(gene => 
            samples.map(sample => matrix[gene][sample] ?? 0).join(',')
        ).join('\n');

        // Create the metadata frame string for R
        const colDataString = `sample,condition\n${samples.map(s => `${s},${metadata[s]}`).join('\n')}`;

        const rCode = `
            library(DESeq2)

            # Read count data
            count_data <- read.csv(text="${countMatrixString}", header=FALSE)
            rownames(count_data) <- c(${genes.map(g => `"${g}"`).join(',')})
            colnames(count_data) <- c(${samples.map(s => `"${s}"`).join(',')})

            # Read metadata
            col_data <- read.csv(text="${colDataString}")
            rownames(col_data) <- col_data$sample
            
            # Ensure order matches
            count_data <- count_data[, rownames(col_data)]

            # Create DESeqDataSet
            dds <- DESeqDataSetFromMatrix(countData = count_data,
                                          colData = col_data,
                                          design = ~ condition)
            
            # Set reference level
            dds$condition <- relevel(dds$condition, ref = "${conditionA}")

            # Run DESeq
            dds <- DESeq(dds)
            res <- results(dds, contrast=c("condition", "${conditionB}", "${conditionA}"))
            res <- as.data.frame(res)
            res <- na.omit(res) # Remove rows with NA p-values
            res$gene <- rownames(res)
            
            # Select columns to return
            res_subset <- res[, c("gene", "log2FoldChange", "padj", "baseMean")]
            
            # Convert to JSON
            json_output <- jsonlite::toJSON(res_subset)
            json_output
        `;

        try {
            const result = await this.webR.evalR(rCode);
            const jsonResult = await result.toJs();
            const deseqResults = JSON.parse(jsonResult[0]);
            
            return deseqResults.map((row: any) => ({
                gene: row.gene,
                log2FoldChange: row.log2FoldChange,
                pvalue: row.padj, // Use adjusted p-value
                averageExpression: row.baseMean,
                negLog10PValue: row.padj > 0 ? -Math.log10(row.padj) : 50,
            }));

        } catch(e: any) {
            console.error("Error during DESeq2 analysis in R:", e);
            throw new Error(`R analysis script failed: ${e.message}`);
        }
    }
    
     async getClusteredOrder(
        matrix: CountMatrix,
        geneSymbols: string[],
        method: ClusteringMethod
    ): Promise<string[]> {
        if (!this.isInitialized) throw new Error("R service not initialized.");
        
        const relevantMatrix: CountMatrix = {};
        geneSymbols.forEach(g => {
            if (matrix[g]) {
                relevantMatrix[g] = matrix[g];
            }
        });

        const genes = Object.keys(relevantMatrix);
        if (genes.length < 3) return geneSymbols; // Not enough genes to cluster
        
        const samples = Object.keys(Object.values(relevantMatrix)[0]);
        
        const countMatrixString = genes.map(gene => 
            samples.map(sample => relevantMatrix[gene][sample] ?? 0).join(',')
        ).join('\\n');

        const rCode = `
            # Read count data
            count_data <- read.csv(text="${countMatrixString}", header=FALSE)
            rownames(count_data) <- c(${genes.map(g => `"${g}"`).join(',')})

            # Perform clustering
            # Using variance stabilizing transformation for distance calculation
            if (!requireNamespace("vsn", quietly = TRUE)) BiocManager::install("vsn", update=FALSE)
            vst_data <- vsn::vst(as.matrix(count_data), fit = TRUE)
            dist_matrix <- dist(vst_data)
            hc <- hclust(dist_matrix, method="${method}")
            
            # Return the ordered labels
            ordered_genes <- hc$labels[hc$order]
            jsonlite::toJSON(ordered_genes)
        `;

        try {
             const result = await this.webR.evalR(rCode);
             const jsonResult = await result.toJs();
             const orderedGenes = JSON.parse(jsonResult[0]);
             return orderedGenes;
        } catch(e: any) {
            console.error(`Error during clustering in R with method ${method}:`, e);
            throw new Error(`R clustering script failed: ${e.message}`);
        }
    }
}