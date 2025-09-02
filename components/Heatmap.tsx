import React, { useState, useEffect, useMemo } from 'react';
import type { GeneData, CountMatrix, ClusteringMethod } from '../types';
import { RService } from '../services/rService';
import LoadingSpinner from './LoadingSpinner';

interface HeatmapProps {
  up: GeneData[];
  down: GeneData[];
  countMatrix: CountMatrix;
  rService: RService;
}

// Simple interpolation for color
const getColor = (value: number, min: number, max: number): string => {
    if (value > 0) { // Upregulated -> red
        const intensity = Math.round(200 * (value / max)) + 55;
        return `rgb(${intensity}, 50, 50)`;
    }
    // Downregulated -> blue
    const intensity = Math.round(200 * (value / min)) + 55;
    return `rgb(50, 50, ${intensity})`;
};


const Heatmap: React.FC<HeatmapProps> = ({ up, down, countMatrix, rService }) => {
    const [orderedGenes, setOrderedGenes] = useState<GeneData[]>([]);
    const [clusteringMethod, setClusteringMethod] = useState<ClusteringMethod>('ward.D2');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initialGenes = useMemo(() => [...up, ...down], [up, down]);

    useEffect(() => {
        const clusterGenes = async () => {
            if (initialGenes.length === 0 || !rService) return;
            
            setIsLoading(true);
            setError(null);
            try {
                const geneSymbols = initialGenes.map(g => g.gene);
                const orderedSymbols = await rService.getClusteredOrder(countMatrix, geneSymbols, clusteringMethod);
                
                const geneMap = new Map(initialGenes.map(g => [g.gene, g]));
                const newOrderedGenes = orderedSymbols.map(symbol => geneMap.get(symbol)).filter(Boolean) as GeneData[];
                setOrderedGenes(newOrderedGenes);

            } catch (e: any) {
                setError(`Clustering failed: ${e.message}`);
                setOrderedGenes(initialGenes); // Fallback to initial order
            } finally {
                setIsLoading(false);
            }
        };

        clusterGenes();
    }, [clusteringMethod, initialGenes, countMatrix, rService]);


    if (initialGenes.length === 0) {
        return <p className="text-gray-400">No significant genes to display in the heatmap.</p>;
    }
    
    if (isLoading) {
        return <LoadingSpinner message={`Running ${clusteringMethod} clustering...`}/>
    }
    
    if (error) {
        return <p className="text-red-400">{error}</p>
    }

    const minLogFC = Math.min(...orderedGenes.map(g => g.log2FoldChange));
    const maxLogFC = Math.max(...orderedGenes.map(g => g.log2FoldChange));

    return (
        <div className="flex flex-col">
             <div className="flex justify-between items-center mb-4">
                <div>
                     <label htmlFor="clustering-method" className="block text-sm font-medium text-gray-400">Clustering Method</label>
                     <select 
                        id="clustering-method"
                        value={clusteringMethod}
                        onChange={(e) => setClusteringMethod(e.target.value as ClusteringMethod)}
                        className="mt-1 block pl-3 pr-10 py-1 text-base bg-gray-900 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md text-white"
                     >
                        <option value="ward.D2">Ward's D2</option>
                        <option value="complete">Complete Linkage</option>
                        <option value="average">Average Linkage (UPGMA)</option>
                        <option value="single">Single Linkage</option>
                    </select>
                </div>
                 <div className="flex items-center space-x-2">
                    <span className="text-xs text-blue-400">{minLogFC.toFixed(1)}</span>
                    <div className="w-32 h-4 bg-gradient-to-r from-blue-500 via-black to-red-500 rounded-sm"></div>
                    <span className="text-xs text-red-400">{maxLogFC.toFixed(1)}</span>
                </div>
            </div>
            <div className="flex justify-between items-center mb-2 px-2">
                <span className="text-sm font-semibold text-gray-300">Gene</span>
                <span className="text-sm font-semibold text-gray-300 w-20 text-right">log2FC</span>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
                {orderedGenes.map(gene => (
                    <div key={gene.gene} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700/50">
                        <span className="font-mono text-sm text-gray-200 truncate pr-4">{gene.gene}</span>
                        <div className="flex items-center space-x-4">
                             <div 
                                className="w-32 h-4 rounded-sm" 
                                style={{ backgroundColor: getColor(gene.log2FoldChange, minLogFC, maxLogFC) }}
                                title={`log2FC: ${gene.log2FoldChange.toFixed(3)}`}
                            ></div>
                            <span className="font-mono text-sm text-gray-300 w-20 text-right">{gene.log2FoldChange.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Heatmap;