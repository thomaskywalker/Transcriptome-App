import * as XLSX from 'xlsx';
import type { CountMatrix, SampleMetadata, GeneIdentifierType } from '../types';

const IDENTIFIER_REGEX: { [key in GeneIdentifierType]: RegExp } = {
    ensembl: /^ENS[A-Z]*G\d+(\.\d+)?$/i,
    entrez: /^\d+$/,
    uniprot: /^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$|^[OPQ][0-9][A-Z0-9]{3}[0-9]$/i,
    symbol: /^[A-Z0-9][A-Z0-9-]{1,10}$/i, // A bit loose, but a decent guess
    unknown: /.*/,
};

export const detectGeneIdentifier = (ids: string[]): GeneIdentifierType => {
    const scores: { [key in GeneIdentifierType]: number } = {
        ensembl: 0, entrez: 0, uniprot: 0, symbol: 0, unknown: 0,
    };

    const testIds = ids.slice(0, 100);

    for (const id of testIds) {
        if (IDENTIFIER_REGEX.ensembl.test(id)) scores.ensembl++;
        else if (IDENTIFIER_REGEX.entrez.test(id)) scores.entrez++;
        else if (IDENTIFIER_REGEX.uniprot.test(id)) scores.uniprot++;
        else if (IDENTIFIER_REGEX.symbol.test(id)) scores.symbol++;
    }
    
    // Check most specific patterns first
    if (scores.ensembl / testIds.length > 0.7) return 'ensembl';
    if (scores.uniprot / testIds.length > 0.7) return 'uniprot';
    if (scores.entrez / testIds.length > 0.7) return 'entrez';
    if (scores.symbol / testIds.length > 0.5) return 'symbol';

    return 'unknown';
};


export const parseCountMatrix = (fileContent: string): { matrix: CountMatrix, identifierType: GeneIdentifierType } => {
    const lines = fileContent.trim().split('\n');
    if (lines.length < 2) return { matrix: {}, identifierType: 'unknown' };

    const headerLine = lines[0].trim();
    const delimiter = headerLine.includes('\t') ? '\t' : ',';
    const headers = headerLine.split(delimiter).map(h => h.replace(/"/g, ''));

    const sampleNames = headers.slice(1);
    const rawMatrix: { [key: string]: { [key: string]: number } } = {};
    const rawGeneIds: string[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].trim().split(delimiter);
        if (values.length < headers.length) continue;

        const geneId = values[0].replace(/"/g, '');
        if (!geneId) continue;

        rawGeneIds.push(geneId);
        rawMatrix[geneId] = {};
        for (let j = 1; j < headers.length; j++) {
            const sampleName = sampleNames[j - 1];
            const count = parseInt(values[j], 10);
            if (!isNaN(count)) {
                rawMatrix[geneId][sampleName] = count;
            }
        }
    }

    const identifierType = detectGeneIdentifier(rawGeneIds);
    const matrix: CountMatrix = {};

    // Process IDs based on detected type
    for (const rawId of rawGeneIds) {
        let finalId = rawId;
        if (identifierType === 'ensembl') {
            finalId = rawId.split('.')[0]; // Trim version only if we're sure it's Ensembl
        }
        
        // Handle cases where trimming might cause ID collisions
        if (matrix[finalId]) {
             for (const sample of sampleNames) {
                matrix[finalId][sample] = (matrix[finalId][sample] || 0) + (rawMatrix[rawId][sample] || 0);
            }
        } else {
             matrix[finalId] = rawMatrix[rawId];
        }
    }

    return { matrix, identifierType };
};

export const parseExcelMetadata = (arrayBuffer: ArrayBuffer): SampleMetadata => {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return {};
    const worksheet = workbook.Sheets[firstSheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 2) return {};

    const headers = data[0].map(h => (h ? String(h).trim().toLowerCase() : ''));

    const sampleIndex = headers.findIndex(h => h.includes('sample'));
    const conditionIndex = headers.findIndex(h => h.includes('condition'));

    if (sampleIndex === -1 || conditionIndex === -1) {
        throw new Error("Excel file must contain 'sample' and 'condition' headers in the first sheet.");
    }
    
    const metadata: SampleMetadata = {};

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if(!row) continue;
        const sample = row[sampleIndex] ? String(row[sampleIndex]).trim() : '';
        const condition = row[conditionIndex] ? String(row[conditionIndex]).trim() : '';

        if (sample && condition) {
            metadata[sample] = condition;
        }
    }

    return metadata;
};

export const parseTextMetadata = (fileContent: string): SampleMetadata => {
    const lines = fileContent.trim().split('\n');
    if (lines.length < 2) return {};

    const headerLine = lines[0].trim().toLowerCase();
    const delimiter = headerLine.includes('\t') ? '\t' : ',';
    const headers = headerLine.split(delimiter).map(h => h.replace(/"/g, ''));
    
    const sampleIndex = headers.findIndex(h => h.includes('sample'));
    const conditionIndex = headers.findIndex(h => h.includes('condition'));

    if (sampleIndex === -1 || conditionIndex === -1) {
        throw new Error("Metadata file must contain 'sample' and 'condition' headers.");
    }
    
    const metadata: SampleMetadata = {};

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].trim().split(delimiter);
        if (values.length < headers.length) continue;

        const sample = values[sampleIndex].replace(/"/g, '');
        const condition = values[conditionIndex].replace(/"/g, '');

        if (sample && condition) {
            metadata[sample] = condition;
        }
    }

    return metadata;
};


// --- ID Conversion Utilities ---

export const convertIdsToSymbols = async (
    ids: string[],
    inputType: GeneIdentifierType
): Promise<{ [key: string]: string }> => {
    // MyGene.info is good at handling versioned Ensembl IDs, so no pre-trimming needed here.
    const scopes = 'ensembl.gene,entrezgene,uniprot'; // Scopes to search in mygene.info
    const conversionMap: { [key: string]: string } = {};
    const batchSize = 1000;

    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        try {
            const response = await fetch('https://mygene.info/v3/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `q=${batch.join(',')}&scopes=${scopes}&fields=symbol&species=human,mouse,rat`,
            });
            if (!response.ok) {
                throw new Error(`MyGene.info API request failed with status ${response.status}`);
            }
            const data = await response.json();
            for (const item of data) {
                if (item.symbol && !item.notfound) {
                    conversionMap[item.query] = item.symbol;
                }
            }
        } catch (error) {
            console.error('Error converting gene IDs:', error);
            // Continue with the next batch even if one fails
        }
    }
    return conversionMap;
};

export const remapMatrixToSymbols = (
    matrix: CountMatrix,
    conversionMap: { [key: string]: string }
): CountMatrix => {
    const newMatrix: CountMatrix = {};

    for (const oldId in matrix) {
        const newSymbol = conversionMap[oldId];
        if (newSymbol) {
            // If the symbol already exists (e.g., from two transcripts mapping to one gene), aggregate counts.
            if (newMatrix[newSymbol]) {
                for (const sample in matrix[oldId]) {
                    newMatrix[newSymbol][sample] = (newMatrix[newSymbol][sample] || 0) + matrix[oldId][sample];
                }
            } else {
                newMatrix[newSymbol] = matrix[oldId];
            }
        }
    }
    return newMatrix;
};