
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, GeneData } from '../types';
import { getChatResponseStream, initChat, resetChat } from '../services/geminiService';

const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

interface ChatbotProps {
    degResults: GeneData[];
    pValueThreshold: number;
}

const Chatbot: React.FC<ChatbotProps> = ({ degResults, pValueThreshold }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', text: 'Hello! Ask me anything about your analysis results.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Initialize the chat session whenever the DEG results change.
        // The history passed here is only for the *initial* setup.
        // We only want the system prompt, so we pass an empty history.
        initChat(degResults, pValueThreshold, []); 
        
        // When the component unmounts or results change, reset the chat instance.
        return () => {
            resetChat();
        };
    }, [degResults, pValueThreshold]);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Since chat is initialized, we just send the message.
            const stream = await getChatResponseStream(input);
            let modelResponse = '';
            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of stream) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = modelResponse;
                    return newMessages;
                });
            }
        } catch (error) {
            console.error('Chatbot error:', error);
            setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 bg-cyan-600 text-white rounded-full p-4 shadow-lg hover:bg-cyan-500 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 z-50"
                aria-label="Open AI Chat"
            >
                <ChatIcon className="h-8 w-8" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-8 right-8 w-full max-w-md h-full max-h-[70vh] bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl flex flex-col z-50 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
                <h3 className="text-lg font-bold text-cyan-400">AI Assistant</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                    <CloseIcon className="h-6 w-6" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-sm px-4 py-2 rounded-lg ${msg.role === 'user' ? 'bg-cyan-700 text-white' : 'bg-gray-700 text-gray-200'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                     <div className="flex justify-start">
                        <div className="max-w-xs md:max-w-sm px-4 py-2 rounded-lg bg-gray-700 text-gray-200">
                           <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700 flex-shrink-0">
                <form onSubmit={handleSend} className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your results..."
                        className="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none text-white"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="bg-cyan-600 text-white rounded-lg p-2 disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-cyan-500">
                        <SendIcon className="h-6 w-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chatbot;