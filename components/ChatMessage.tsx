import React, { useState, useRef, useEffect } from 'react';
import { Message, Role } from '../types';
import { User, Bot, AlertCircle, Volume2, StopCircle, Loader2 } from 'lucide-react';
import { geminiService } from '../services/geminiService';

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
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-indigo-600' : message.isError ? 'bg-red-500' : 'bg-emerald-600'
        }`}>
          {isUser ? <User size={16} className="text-white" /> : 
           message.isError ? <AlertCircle size={16} className="text-white" /> :
           <Bot size={16} className="text-white" />}
        </div>

        {/* Message Bubble */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`px-4 py-3 rounded-2xl text-sm md:text-base leading-relaxed whitespace-pre-wrap shadow-sm group relative ${
              isUser
                ? 'bg-indigo-600 text-white rounded-tr-none'
                : message.isError 
                  ? 'bg-red-900/50 text-red-100 border border-red-800 rounded-tl-none'
                  : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
            }`}
          >
            {message.text}
            
            {/* TTS Button for Model Messages */}
            {!isUser && !message.isError && (
              <button 
                onClick={handlePlayAudio}
                disabled={isAudioLoading}
                className="absolute -bottom-8 left-0 p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Read aloud"
              >
                {isAudioLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isPlaying ? (
                  <StopCircle size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
            )}
          </div>
          <span className="text-xs text-slate-500 mt-1 px-1">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

      </div>
    </div>
  );
};

export default ChatMessage;