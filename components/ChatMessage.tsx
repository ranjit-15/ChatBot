import React, { useState, useRef, useEffect } from 'react';
import { Message, Role } from '../types';
import { User, Sparkles, AlertCircle, Volume2, StopCircle, Loader2, Copy, Check } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessageProps {
  message: Message;
}

// Audio decoding helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
      title="Copy code"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.USER;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handlePlayAudio = async () => {
    if (isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    try {
      setIsAudioLoading(true);
      const base64Audio = await geminiService.generateSpeech(message.text);
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContextRef.current,
        24000,
        1
      );

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        sourceNodeRef.current = null;
      };

      sourceNodeRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (error) {
      console.error("Failed to play audio:", error);
      alert("Failed to generate speech. Please try again.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`flex w-full max-w-[90%] md:max-w-[80%] lg:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
          isUser 
            ? 'bg-gray-800 border border-gray-700' 
            : message.isError 
              ? 'bg-red-500/10 border border-red-500/20' 
              : 'bg-indigo-500/10 border border-indigo-500/20'
        }`}>
          {isUser ? <User size={14} className="text-gray-400" /> : 
           message.isError ? <AlertCircle size={14} className="text-red-400" /> :
           <Sparkles size={14} className="text-indigo-400" />}
        </div>

        {/* Message Bubble */}
        <div className={`flex flex-col w-full min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`px-5 py-3.5 rounded-2xl text-[15px] md:text-base leading-relaxed shadow-md relative group max-w-full overflow-hidden ${
              isUser
                ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-tr-sm'
                : message.isError 
                  ? 'bg-red-500/10 text-red-100 border border-red-500/20 rounded-tl-sm backdrop-blur-sm'
                  : 'bg-white/5 text-gray-100 border border-white/5 rounded-tl-sm backdrop-blur-md'
            }`}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="pl-1">{children}</li>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:text-indigo-200 underline decoration-indigo-400/30 underline-offset-2">
                    {children}
                  </a>
                ),
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const codeString = String(children).replace(/\n$/, '');

                  if (!inline && match) {
                    return (
                      <div className="rounded-lg overflow-hidden my-3 border border-white/10 shadow-lg bg-[#0d1117] w-full">
                        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{language}</span>
                          <CopyButton text={codeString} />
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus}
                          language={language}
                          PreTag="div"
                          {...props}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            background: 'transparent',
                            fontSize: '0.9em',
                            lineHeight: '1.5',
                          }}
                          codeTagProps={{
                            style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  
                  // Fallback for code blocks without language specified or inline code
                  if (!inline) {
                     return (
                      <div className="rounded-lg overflow-hidden my-3 border border-white/10 shadow-lg bg-[#0d1117] w-full">
                         <div className="flex items-center justify-end px-4 py-2 bg-white/5 border-b border-white/5">
                           <CopyButton text={codeString} />
                         </div>
                         <div className="p-4 overflow-x-auto text-sm font-mono text-gray-200">
                           <pre>{codeString}</pre>
                         </div>
                      </div>
                     )
                  }

                  return (
                    <code className={`bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-indigo-200 border border-white/5`} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {message.text}
            </ReactMarkdown>
            
            {/* TTS Button for Model Messages */}
            {!isUser && !message.isError && (
              <button 
                onClick={handlePlayAudio}
                disabled={isAudioLoading}
                className="absolute -bottom-8 left-0 p-1.5 text-gray-500 hover:text-indigo-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center gap-1.5 text-xs font-medium"
                title="Read aloud"
              >
                {isAudioLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isPlaying ? (
                  <StopCircle size={14} />
                ) : (
                  <Volume2 size={14} />
                )}
                <span>{isPlaying ? 'Stop' : 'Read'}</span>
              </button>
            )}
          </div>
          <span className={`text-[10px] uppercase tracking-wider font-medium mt-1.5 px-1 ${isUser ? 'text-gray-500' : 'text-gray-600'}`}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

      </div>
    </div>
  );
};

export default ChatMessage;