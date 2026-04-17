import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Key, Check, Code, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ChatPanel = ({ isOpen, onClose, currentScript, onApplyScript, specContent }) => {
  const [apiKey, setApiKey] = useState('');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setIsEditingKey(true);
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const saveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setIsEditingKey(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !apiKey) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: `You are MelodyScript AI, an expert music composer assistant for the MelodyScript Studio.
        
Here is the specification for the MelodyScript language:
${specContent}

Here is the user's CURRENT script in the editor:
\`\`\`melodyscript
${currentScript}
\`\`\`

Instructions:
1. Help the user compose, debug, or modify their music.
2. If you generate or modify MelodyScript code, you MUST format it in a markdown code block tagged with "melodyscript". 
   Example:
   \`\`\`melodyscript
   @TEMPO: 120
   CH1 @INST: PIANO
   CH1: C-4
   \`\`\`
3. Keep explanations concise.`
      });

      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMsg);
      const responseText = result.response.text();

      setMessages(prev => [...prev, { role: 'model', content: responseText }]);
    } catch (error) {
      console.error("Gemini API Error:", error);
      setMessages(prev => [...prev, { role: 'model', content: `**Error:** ${error.message}\n\nPlease check your API key.` }]);
      if (error.message.includes('API key')) {
        setIsEditingKey(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className={`relative h-full bg-slate-900 border-slate-700 shadow-2xl transition-[width,min-width,border-width] duration-300 ease-in-out z-40 overflow-hidden shrink-0 ${isOpen ? 'w-[450px] min-w-[450px] border-l' : 'w-0 min-w-0 border-l-0'}`}
    >
      <div className="w-[450px] h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">        <div className="flex items-center gap-2">
          <Bot className="text-indigo-400" size={20} />
          <h2 className="font-bold text-slate-200">Melody AI</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsEditingKey(!isEditingKey)} className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors" title="API Key Settings">
            <Key size={16} />
          </button>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      {isEditingKey && (
        <div className="p-4 bg-slate-800 border-b border-slate-700">
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Gemini API Key</label>
          <div className="flex gap-2">
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <button 
              onClick={() => saveApiKey(apiKey)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
            >
              Save
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Your key is stored locally in your browser.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {messages.length === 0 && !isEditingKey && (
          <div className="text-center text-slate-500 mt-10">
            <Bot size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">Hi! I'm your MelodyScript assistant.</p>
            <p className="text-xs mt-2">Ask me to add drums, create a chord progression, or fix syntax errors.</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-indigo-400" />}
            </div>
            <div className={`flex flex-col gap-1 max-w-[90%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`text-sm rounded-2xl px-4 py-2 custom-markdown w-full ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                {msg.role === 'user' ? (
                  <p>{msg.content}</p>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({...props}) => <p className="mb-2 last:mb-0" {...props} />,
                      code: ({inline, className, children, ...props}) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isMelodyScript = match && match[1] === 'melodyscript';
                        
                        if (!inline && match) {
                          return (
                            <div className="my-3 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 w-full">
                              <div className="flex justify-between items-center bg-slate-900 px-3 py-1.5 border-b border-slate-700 gap-2">
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate">{match[1]}</span>
                                {isMelodyScript && (
                                  <button 
                                    onClick={() => onApplyScript(String(children).trim())}
                                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors shrink-0 whitespace-nowrap"
                                  >
                                    <Check size={12} /> APPLY TO EDITOR
                                  </button>
                                )}
                              </div>
                              <div className="p-3 overflow-x-auto">
                                <code className="text-xs font-mono text-indigo-300" {...props}>{children}</code>
                              </div>
                            </div>
                          );
                        }
                        return <code className="bg-slate-900 text-indigo-300 px-1 py-0.5 rounded text-[11px] font-mono" {...props}>{children}</code>;
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-indigo-400" />
            </div>
            <div className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 size={16} className="text-indigo-400 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask AI to compose or modify..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none h-10 max-h-32 custom-scrollbar"
            rows="1"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading || !apiKey}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-2 rounded-xl transition-colors flex items-center justify-center shrink-0 w-10 h-10"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ChatPanel;