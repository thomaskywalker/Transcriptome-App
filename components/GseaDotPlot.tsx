
import React from 'react';
// FIX: Import 'Cell' from 'recharts' to fix a compile error.
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Label, Cell } from 'recharts';
import type { GseaResult } from '../types';

interface GseaDotPlotProps {
  data: GseaResult[];
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-800 text-white p-3 border border-gray-600 rounded-md shadow-lg max-w-xs">
                <p className="font-bold text-cyan-400 break-words">{data.Description}</p>
                <p>NES: <span className="font-semibold">{data.NES.toFixed(3)}</span></p>
                <p>Adj. p-value: <span className="font-semibold">{data['p.adjust'].toExponential(3)}</span></p>
                <p>Gene Set Size: <span className="font-semibold">{data.setSize}</span></p>
            </div>
        );
    }
    return null;
};

// Color scale from red (high p-adj) to blue (low p-adj)
const getColor = (pAdjust: number) => {
    const logP = -Math.log10(pAdjust);
    // Simple scale: map logP to blue intensity. Clamp for visibility.
    const blueIntensity = Math.min(255, 50 + logP * 40);
    const redIntensity = Math.max(50, 255 - logP * 40);
    return `rgb(${redIntensity}, 100, ${blueIntensity})`;
};

const GseaDotPlot: React.FC<GseaDotPlotProps> = ({ data }) => {
   
    const topResults = [...data]
        .sort((a, b) => a['p.adjust'] - b['p.adjust'])
        .slice(0, 20);

    if (topResults.length === 0) {
        return <p className="text-gray-400 text-center p-4">No significant enrichment results found for this database.</p>;
    }

  return (
    <div style={{ width: '100%', height: 600 }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 200 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            type="number" 
            dataKey="NES" 
            name="Normalized Enrichment Score"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: '#9ca3af' }}
            stroke="#6b7280"
          >
             <Label value="Normalized Enrichment Score (NES)" offset={-25} position="insideBottom" fill="#d1d5db"/>
          </XAxis>
          <YAxis 
            type="category" 
            dataKey="Description" 
            width={150}
            tick={{ fill: '#9ca3af', fontSize: 12, width: 150 }}
            interval={0}
          />
          <ZAxis dataKey="setSize" name="Gene Set Size" range={[100, 1000]} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#4b5563' }} />
          <Scatter name="Pathways" data={topResults}>
            {topResults.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry['p.adjust'])} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GseaDotPlot;
