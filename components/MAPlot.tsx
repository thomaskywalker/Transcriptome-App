import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Label, Cell } from 'recharts';
import type { GeneData } from '../types';

interface MAPlotProps {
  data: GeneData[];
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-800 text-white p-3 border border-gray-600 rounded-md shadow-lg">
                <p className="font-bold text-cyan-400">{data.gene}</p>
                <p>Avg. Expression: <span className="font-semibold">{data.averageExpression?.toFixed(3)}</span></p>
                <p>log2 Fold Change: <span className="font-semibold">{data.log2FoldChange.toFixed(3)}</span></p>
                <p>p-value: <span className="font-semibold">{data.pvalue.toExponential(3)}</span></p>
            </div>
        );
    }
    return null;
};

const MAPlot: React.FC<MAPlotProps> = ({ data }) => {
    const pThreshold = 0.05;
    const fcThreshold = 1.0;

    const plotData = data
        .filter(d => d.averageExpression && d.averageExpression > 0)
        .map(d => ({ ...d, log10AvgExpr: Math.log10(d.averageExpression!) }));

    if (plotData.length === 0) {
        return <p className="text-gray-400">No data available for MA Plot. Ensure your data contains an 'averageExpression' or 'baseMean' column with values greater than 0.</p>;
    }

    const getColor = (entry: GeneData) => {
        if (entry.pvalue < pThreshold && Math.abs(entry.log2FoldChange) > fcThreshold) {
            return '#f87171'; // Red for significant
        }
        return '#6b7280'; // Gray for non-significant
    };

  return (
    <div style={{ width: '100%', height: 500 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            type="number" 
            dataKey="log10AvgExpr" 
            name="log10(Average Expression)"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: '#9ca3af' }}
            stroke="#6b7280"
          >
             <Label value="log10(Average Expression)" offset={-25} position="insideBottom" fill="#d1d5db"/>
          </XAxis>
          <YAxis 
            type="number" 
            dataKey="log2FoldChange" 
            name="log2(Fold Change)"
            tick={{ fill: '#9ca3af' }}
            stroke="#6b7280"
          >
            <Label value="log2(Fold Change)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#d1d5db' }}/>
          </YAxis>
          <ZAxis dataKey="gene" name="gene" />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#4b5563' }} />
          <Scatter name="Genes" data={plotData} fill="#8884d8">
            {plotData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MAPlot;
