
import React from 'react';
import type { GeneData } from '../types';

interface GeneTableProps {
  genes: GeneData[];
}

const GeneTable: React.FC<GeneTableProps> = ({ genes }) => {
  if (!genes || genes.length === 0) {
    return <p className="text-gray-400">No significant genes to display in this category.</p>;
  }

  return (
    <div className="overflow-x-auto max-h-96">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800 sticky top-0">
          <tr>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-300">Gene</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-300">log2FC</th>
            <th scope="col" className="py-3.5 px-3 text-left text-sm font-semibold text-gray-300">p-value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50 bg-gray-900">
          {genes.map((gene) => (
            <tr key={gene.gene} className="hover:bg-gray-800/50">
              <td className="whitespace-nowrap py-4 px-3 text-sm font-medium text-gray-200">{gene.gene}</td>
              <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-300">{gene.log2FoldChange.toFixed(3)}</td>
              <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-300">{gene.pvalue.toExponential(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GeneTable;
