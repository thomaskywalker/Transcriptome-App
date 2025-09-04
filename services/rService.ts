
import type { CountMatrix, SampleMetadata, GeneData, ClusteringMethod, GseaResult, GseaDatabase } from '../types';

type Package = 'BiocManager' | 'DESeq2' | 'clusterProfiler' | 'org.Hs.eg.db' | 'vsn';
type PackageStatus = 'not_installed' | 'installing' | 'installed';

export class RService {
    private webR: any;
    private statusLogCallback: (msg: string) => void = () => {};
    private consoleLogCallback: (log: string) => void = () => {};

    private packageStatus: Record<Package, PackageStatus> = {
        'BiocManager': 'not_installed',
        'DESeq2': 'not_installed',
        'clusterProfiler': 'not_installed',
        'org.Hs.eg.db': 'not_installed',
        'vsn': 'not_installed'
    };

    private async waitForWebR(timeout = 1200000): Promise<void> {
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                if ((window as any).webR) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error("WebR failed to initialize within the timeout period. This might be due to a slow network connection or a browser compatibility issue. Please try reloading the page."));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async init(statusLogCallback: (msg: string) => void, consoleLogCallback: (log: string) => void) {
        if (this.packageStatus['BiocManager'] !== 'not_installed') return;

        this.statusLogCallback = statusLogCallback;
        this.consoleLogCallback = consoleLogCallback;
        this.statusLogCallback('Initializing R environment...');
        
        this.packageStatus['BiocManager'] = 'installing'; 
        
        try {
            await this.waitForWebR();
            this.webR = new (window as any).webR.WebR();
            await this.webR.init();
            
            // CRITICAL FIX: The listener must be set up correctly.
            // 1. Enable the message channel.
            await this.webR.evalR("options(webr.msg.chan = TRUE)");
            
            // 2. Start a background loop to read from the main webR object's queue.
            (async () => {
                for (;;) {
                    const msg = await this.webR.read(); // Read from the main webR object
                     if (msg.type === 'stdout' || msg.type === 'stderr') {
                        this.consoleLogCallback(msg.data); // data is already a string
                    }
                }
            })();

            // 3. Send a test message to confirm the connection is live.
            this.statusLogCallback('Establishing R console connection...');
            await this.webR.evalR('print("R Console connection established.")');
            
            this.statusLogCallback('Installing BiocManager...');
            await this.webR.evalR('if (!requireNamespace("BiocManager", quietly = TRUE)) install.packages("BiocManager")');
            
            this.packageStatus['BiocManager'] = 'installed';
            this.statusLogCallback('R environment ready.');
        } catch (e) {
            this.packageStatus['BiocManager'] = 'not_installed';
            console.error("Failed to initialize R or BiocManager", e);
            throw e;
        }
    }

    private async ensurePackage(pkg: Package, installCmd: string) {
        if (this.packageStatus[pkg] === 'installed') {
            return;
        }

        // If another process is already installing, wait for it
        while (this.packageStatus[pkg] === 'installing') {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Re-check status after waiting, in case it's now installed
        if (this.packageStatus[pkg] === 'installed') {
            return;
        }

        this.packageStatus[pkg] = 'installing';
        try {
            this.statusLogCallback(`Installing ${pkg} (one-time setup, may take a few minutes)...`);
            await this.webR.evalR(installCmd);
            this.packageStatus[pkg] = 'installed';
            this.statusLogCallback(`${pkg} installed successfully.`);
        } catch (e) {
            this.packageStatus[pkg] = 'not_installed'; // Reset on failure to allow retry
            this.statusLogCallback(`Failed to install ${pkg}.`);
            console.error(`Error installing ${pkg}:`, e);
            throw e;
        }
    }


    async runDeseq2(
        matrix: CountMatrix,
        metadata: SampleMetadata,
        conditionA: string,
        conditionB: string
    ): Promise<GeneData[]> {
        if (this.packageStatus['BiocManager'] !== 'installed') throw new Error("R service not initialized.");
        
        await this.ensurePackage('DESeq2', 'if (!requireNamespace("DESeq2", quietly = TRUE)) BiocManager::install("DESeq2", update=FALSE)');
        
        const genes = Object.keys(matrix);
        const samples = Object.keys(metadata);
        
        // Create CSV strings
        const countHeader = ['gene', ...samples].join(',');
        const countMatrixString = [countHeader, ...genes.map(gene => 
            [gene, ...samples.map(sample => matrix[gene][sample] ?? 0)].join(',')
        )].join('\n');
        const colDataString = `sample,condition\n${samples.map(s => `${s},${metadata[s]}`).join('\n')}`;
        
        // Write data to virtual file system for performance
        await this.webR.FS.writeFile('/data/counts.csv', countMatrixString);
        await this.webR.FS.writeFile('/data/metadata.csv', colDataString);

        const rCode = `
            # Load necessary library
            library(DESeq2)
            
            # Read data from virtual files
            count_data_raw <- read.csv('/data/counts.csv', row.names=1)
            col_data <- read.csv('/data/metadata.csv', row.names=1)
            
            # Ensure matrix columns and metadata rows are in the same order
            count_data <- count_data_raw[, rownames(col_data)]

            # Create DESeqDataSet
            dds <- DESeqDataSetFromMatrix(countData = count_data, colData = col_data, design = ~ condition)
            
            # Set the reference level for comparison
            dds$condition <- relevel(dds$condition, ref = "${conditionA}")
            
            # Run DESeq analysis
            dds <- DESeq(dds)
            
            # Get results
            res <- results(dds, contrast=c("condition", "${conditionB}", "${conditionA}"))
            res <- as.data.frame(res)
            res <- na.omit(res)
            res$gene <- rownames(res)
            
            # Select relevant columns and convert to JSON
            res_subset <- res[, c("gene", "log2FoldChange", "padj", "baseMean")]
            jsonlite::toJSON(res_subset)
        `;

        try {
            this.statusLogCallback('Running DESeq2 analysis...');
            const result = await this.webR.evalR(rCode);
            const jsonResult = await result.toJs();
            const deseqResults = JSON.parse(jsonResult[0]);
            
            await this.webR.FS.unlink('/data/counts.csv');
            await this.webR.FS.unlink('/data/metadata.csv');

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
        if (this.packageStatus['BiocManager'] !== 'installed') throw new Error("R service not initialized.");
        await this.ensurePackage('vsn', 'if (!requireNamespace("vsn", quietly = TRUE)) BiocManager::install("vsn", update=FALSE)');

        const relevantMatrix: { [key: string]: { [key: string]: number } } = {};
        geneSymbols.forEach(g => {
            if (matrix[g]) {
                relevantMatrix[g] = matrix[g];
            }
        });

        const genes = Object.keys(relevantMatrix);
        if (genes.length < 3) return geneSymbols;
        
        const samples = Object.keys(Object.values(relevantMatrix)[0]);
        
        const countHeader = ['gene', ...samples].join(',');
        const countMatrixString = [countHeader, ...genes.map(gene =>
             [gene, ...samples.map(sample => relevantMatrix[gene][sample] ?? 0)].join(',')
        )].join('\n');
        
        await this.webR.FS.writeFile('/data/heatmap_counts.csv', countMatrixString);

        const rCode = `
            library(vsn)
            count_data <- read.csv('/data/heatmap_counts.csv', row.names=1)
            
            # VST normalize data for clustering
            vst_data <- vsn::vst(as.matrix(count_data), fit = TRUE)
            
            # Calculate distance and perform hierarchical clustering
            dist_matrix <- dist(vst_data)
            hc <- hclust(dist_matrix, method="${method}")
            
            # Get the ordered gene labels
            ordered_genes <- hc$labels[hc$order]
            jsonlite::toJSON(ordered_genes)
        `;

        try {
             const result = await this.webR.evalR(rCode);
             const jsonResult = await result.toJs();
             await this.webR.FS.unlink('/data/heatmap_counts.csv');
             return JSON.parse(jsonResult[0]);
        } catch(e: any) {
            console.error(`Error during clustering in R with method ${method}:`, e);
            throw new Error(`R clustering script failed: ${e.message}`);
        }
    }

    async runGsea(
        degResults: GeneData[],
        database: GseaDatabase
    ): Promise<GseaResult[]> {
        if (this.packageStatus['BiocManager'] !== 'installed') throw new Error("R service not initialized.");
        
        await this.ensurePackage('clusterProfiler', 'if (!requireNamespace("clusterProfiler", quietly = TRUE)) BiocManager::install("clusterProfiler", update=FALSE)');
        await this.ensurePackage('org.Hs.eg.db', 'if (!requireNamespace("org.Hs.eg.db", quietly = TRUE)) BiocManager::install("org.Hs.eg.db", update=FALSE)');
        
        const rankedGenes = [...degResults]
            .filter(g => g.pvalue !== null && isFinite(g.log2FoldChange) && g.gene)
            .sort((a, b) => b.log2FoldChange - a.log2FoldChange);

        const geneListString = `gene,log2FC\n${rankedGenes.map(g => `"${g.gene}",${g.log2FoldChange}`).join('\n')}`;
        await this.webR.FS.writeFile('/data/gene_list.csv', geneListString);
        
        const dbCommand = {
            'GO': `gseGO(geneList=geneList, ont="BP", OrgDb=org.Hs.eg.db, keyType="SYMBOL", minGSSize=10, maxGSSize=500, pvalueCutoff=1, verbose=FALSE)`,
            'KEGG': `gseKEGG(geneList=kegg_gene_list, organism='hsa', minGSSize=10, maxGSSize=500, pvalueCutoff=1, verbose=FALSE)`,
        };

        const rCode = `
            library(clusterProfiler)
            library(org.Hs.eg.db)
            
            # Read ranked gene list from virtual file
            gene_list_df <- read.csv('/data/gene_list.csv')
            geneList <- gene_list_df$log2FC
            names(geneList) <- gene_list_df$gene
            
            # Remove duplicates and sort
            geneList <- geneList[!duplicated(names(geneList))]
            geneList <- sort(geneList, decreasing = TRUE)
            
            gsea_results <- NULL
            # Special handling for KEGG, which requires Entrez IDs
            if ("${database}" == "KEGG") {
                ids <- bitr(names(geneList), fromType="SYMBOL", toType="ENTREZID", OrgDb="org.Hs.eg.db")
                dedup_ids <- ids[!duplicated(ids[c("SYMBOL")]),]
                
                df2 <- gene_list_df[gene_list_df$gene %in% dedup_ids$SYMBOL,]
                df2 <- merge(df2, dedup_ids, by.x="gene", by.y="SYMBOL")

                kegg_gene_list <- df2$log2FC
                names(kegg_gene_list) <- df2$ENTREZID
                kegg_gene_list <- sort(kegg_gene_list, decreasing = TRUE)
                
                gsea_results <- tryCatch({ ${dbCommand['KEGG']} }, error = function(e) { return(NULL) })
            } else {
                 gsea_results <- tryCatch({ ${dbCommand['GO']} }, error = function(e) { return(NULL) })
            }
            
            # Return results as JSON, or an empty array if no results
            if (is.null(gsea_results) || nrow(as.data.frame(gsea_results)) == 0) {
                "[]"
            } else {
                jsonlite::toJSON(as.data.frame(gsea_results))
            }
        `;

        try {
            this.statusLogCallback(`Running GSEA with ${database}...`);
            const result = await this.webR.evalR(rCode);
            const jsonResult = await result.toJs();
            await this.webR.FS.unlink('/data/gene_list.csv');
            return JSON.parse(jsonResult[0]);
        } catch(e: any) {
            console.error(`Error during GSEA analysis in R:`, e);
            throw new Error(`R GSEA script failed: ${e.message}`);
        }
    }
}
