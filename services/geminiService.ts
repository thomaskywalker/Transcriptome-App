
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import type { GeneData, AnalysisType, AnalysisResult, ChatMessage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const FC_THRESHOLD = 1.0;

const getSignificantGenes = (data: GeneData[], pValueThreshold: number) => {
    const up = data
        .filter(g => g.pvalue < pValueThreshold && g.log2FoldChange > FC_THRESHOLD)
        .sort((a, b) => b.log2FoldChange - a.log2FoldChange);
    const down = data
        .filter(g => g.pvalue < pValueThreshold && g.log2FoldChange < -FC_THRESHOLD)
        .sort((a, b) => a.log2FoldChange - b.log2FoldChange);
    return { up, down };
};

const formatGeneListForPrompt = (genes: GeneData[], count: number = 25): string => {
    if (!genes || genes.length === 0) return 'None';
    return genes.slice(0, count).map(g => `${g.gene} (logFC: ${g.log2FoldChange.toFixed(2)}, p-value: ${g.pvalue.toExponential(2)})`).join(', ');
};

const getInterpretationPrompt = (analysisType: AnalysisType, data: GeneData[], pValueThreshold: number): string => {
    const significantGenes = getSignificantGenes(data, pValueThreshold);
    const topUpGenes = formatGeneListForPrompt(significantGenes.up);
    const topDownGenes = formatGeneListForPrompt(significantGenes.down);

    switch (analysisType) {
        case 'summary':
             return `
You are a senior bioinformatician. Based on the provided DEG results from a DESeq2 analysis, provide a high-level summary of the potential findings.
Mention the number of significantly up-regulated (${significantGenes.up.length}) and down-regulated (${significantGenes.down.length}) genes (using adjusted p-value < ${pValueThreshold} and |log2FoldChange| > ${FC_THRESHOLD}).
Briefly mention the most significant genes by name.

Top up-regulated: ${topUpGenes}
Top down-regulated: ${topDownGenes}

Provide your summary as a concise text.
            `;
        default:
             return `
You are a senior bioinformatician interpreting differential gene expression data from a DESeq2 analysis.
The key findings are summarized by these significant genes:

Most significantly up-regulated genes: ${topUpGenes}
Most significantly down-regulated genes: ${topDownGenes}

Provide a concise, expert interpretation of these results. What might these gene changes imply biologically?
Focus on the overall pattern and potential biological significance based on the most changed genes.
            `;
    }
};


export const getAnalysisFromGemini = async (analysisType: AnalysisType, data: GeneData[], pValueThreshold: number): Promise<AnalysisResult> => {
    const prompt = getInterpretationPrompt(analysisType, data, pValueThreshold);
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const significantGenes = getSignificantGenes(data, pValueThreshold);
        
        return {
            type: analysisType,
            text: response.text,
            significantGenes: significantGenes
        };

    } catch (error) {
        console.error("Error calling Gemini API for interpretation:", error);
        throw new Error("The AI model could not process the interpretation request. Please check your data or try again later.");
    }
};

// --- Chat Service ---

let chat: Chat | null = null;

const formatGeneListForChatContext = (genes: GeneData[], count: number = 10): string => {
    if (!genes || genes.length === 0) return 'None';
    return genes.slice(0, count).map(g => `- ${g.gene} (logFC: ${g.log2FoldChange.toFixed(2)}, padj: ${g.pvalue.toExponential(2)})`).join('\n');
};

export const initChat = (
    degResults: GeneData[],
    pValueThreshold: number,
    initialHistory: ChatMessage[] = []
) => {
    const significantGenes = getSignificantGenes(degResults, pValueThreshold);
    const topUpGenes = formatGeneListForChatContext(significantGenes.up);
    const topDownGenes = formatGeneListForChatContext(significantGenes.down);

    const systemInstruction = `You are a helpful bioinformatician assistant. The user has performed a differential gene expression (DEG) analysis using DESeq2.
    You can answer questions about the results, interpret gene functions, and perform pathway analysis (e.g., "what pathways are associated with the up-regulated genes?").
    Here is the summary of their results:
    - Significantly Up-regulated Genes: ${significantGenes.up.length}
    - Significantly Down-regulated Genes: ${significantGenes.down.length}

    Top 10 Up-regulated Genes:
    ${topUpGenes}

    Top 10 Down-regulated Genes:
    ${topDownGenes}

    Based on this data, answer the user's questions. Be concise and helpful. The p-values shown are adjusted p-values (padj).`;
    
    // Convert UI message history to the format the API expects.
    const chatHistory = initialHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: chatHistory,
        config: {
            systemInstruction,
        },
    });
};

export const getChatResponseStream = async (message: string) => {
    if (!chat) {
        throw new Error("Chat not initialized. Please call initChat first.");
    }
    // The Chat object automatically tracks history, so we just send the new message.
    const responseStream = await chat.sendMessageStream({ message });
    return responseStream;
};

export const resetChat = () => {
    chat = null;
};