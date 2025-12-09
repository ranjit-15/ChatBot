import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Sparkles, AlertTriangle, BrainCircuit, Mic, StopCircle } from 'lucide-react';
import { geminiService } from './services/geminiService';
import { Message, Role } from './types';
import ChatMessage from './components/ChatMessage';
import TypingIndicator from './components/TypingIndicator';

const STORAGE_KEY = 'chat_history';

// Interface for Web Speech API
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
    
    return [
      {
        id: 'welcome',
        role: Role.MODEL,
        text: "Hello! I'm your AI assistant. How can I help you today?",
        timestamp: new Date()
      }
    ];
  });
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const textBeforeListening = useRef('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the conversation?')) {
      geminiService.startNewSession();
      const newMessages: Message[] = [{
        id: crypto.randomUUID(),
        role: Role.MODEL,
        text: "Conversation cleared. What would you like to discuss now?",
        timestamp: new Date()
      }];
      setMessages(newMessages);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const w = window as unknown as IWindow;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    textBeforeListening.current = inputValue;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      const prefix = textBeforeListening.current ? textBeforeListening.current + ' ' : '';
      setInputValue(prefix + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (isListening) {
      toggleListening();
      // Allow state update to settle before submitting? 
      // Actually, usually we just stop listening and let the user review, but if they hit enter...
      // Let's just stop listening if they force submit.
    }

    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');
    
    // Create User Message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: Role.USER,
      text: userText,
      timestamp: new Date()
    };

    // Capture current messages before update for history
    const currentHistory = [...messages];

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Create placeholder for Bot Message
    const botMessageId = crypto.randomUUID();
    const initialBotMessage: Message = {
      id: botMessageId,
      role: Role.MODEL,
      text: '',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, initialBotMessage]);

    try {
      const stream = geminiService.sendMessageStream(userText, isThinkingMode, currentHistory);
      let fullResponse = '';

      for await (const chunk of stream) {
        fullResponse += chunk;
        
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, text: fullResponse }
            : msg
        ));
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMessageId 
          ? { 
              ...msg, 
              text: error.message || "Sorry, I encountered an error while processing your request.", 
              isError: true 
            }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Check if API Key is configured (conceptually)
  const isApiKeyMissing = !process.env.API_KEY;

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans">
      
      {/* Header */}
      <header className="flex-none h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 md:px-8 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-lg">
            <Sparkles size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            ChatBot
          </h1>
        </div>
        <button 
          onClick={handleClearChat}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
          title="Clear Conversation"
        >
          <Trash2 size={20} />
        </button>
      </header>

      {/* Warning if no API Key */}
      {isApiKeyMissing && (
        <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 m-4 rounded-r shadow-md">
          <div className="flex items-start">
            <AlertTriangle className="text-amber-500 mr-3 mt-1" size={20} />
            <div>
              <p className="font-bold text-amber-500">API Key Missing</p>
              <p className="text-sm text-amber-200/80">
                Please ensure <code>process.env.API_KEY</code> is set in your environment variables to use the Gemini API.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:px-20 scroll-smooth">
        <div className="max-w-4xl mx-auto flex flex-col">
          {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && messages[messages.length - 1]?.text === '' && (
             <div className="flex w-full mb-6 justify-start">
                <div className="flex max-w-[85%] flex-row gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <TypingIndicator />
                </div>
             </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-none p-4 md:p-6 bg-slate-900 border-t border-slate-800">
        <div className="max-w-4xl mx-auto relative">
          <div className="mb-2 flex items-center justify-end">
            <label className="flex items-center cursor-pointer space-x-2 text-xs md:text-sm text-slate-400 hover:text-indigo-400 transition-colors">
              <span className={isThinkingMode ? "text-indigo-400 font-medium" : ""}>Thinking Mode</span>
              <div 
                onClick={() => setIsThinkingMode(!isThinkingMode)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ease-in-out ${isThinkingMode ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <div 
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out transform ${isThinkingMode ? 'translate-x-5' : 'translate-x-0'}`} 
                />
              </div>
              <BrainCircuit size={16} className={isThinkingMode ? "text-indigo-400" : "text-slate-500"} />
            </label>
          </div>

          <form onSubmit={handleSubmit} className="relative group">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : (isThinkingMode ? "Ask a complex question..." : "Ask me anything...")}
              className={`w-full bg-slate-800 text-slate-100 border rounded-2xl pl-5 pr-28 py-4 focus:outline-none focus:ring-2 transition-all resize-none shadow-lg placeholder:text-slate-500 ${
                isThinkingMode 
                  ? "border-indigo-500/50 focus:ring-indigo-500 focus:border-indigo-500" 
                  : "border-slate-700 focus:ring-indigo-500/50 focus:border-indigo-500"
              } ${isListening ? "ring-2 ring-red-500/50 border-red-500" : ""}`}
              style={{ minHeight: '60px', maxHeight: '200px' }}
              disabled={isApiKeyMissing}
            />
            
            <div className="absolute right-3 bottom-3 flex gap-2">
              <button
                type="button"
                onClick={toggleListening}
                disabled={isApiKeyMissing || isLoading}
                className={`p-2 rounded-xl transition-all shadow-md hover:scale-105 ${
                  isListening 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                }`}
                title={isListening ? "Stop Recording" : "Start Voice Input"}
              >
                {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
              </button>

              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading || isApiKeyMissing}
                className={`p-2 text-white rounded-xl disabled:opacity-50 transition-all shadow-md group-focus-within:scale-105 ${
                  isThinkingMode ? "bg-indigo-600 hover:bg-indigo-500" : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                <Send size={20} />
              </button>
            </div>
          </form>
          <div className="text-center mt-2">
            <p className="text-xs text-slate-500">
              {isThinkingMode 
                ? "Powered by Gemini 3.0 Pro (Thinking Mode). Responses may take longer." 
                : "Powered by Gemini 2.5 Flash. AI can make mistakes."}
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;