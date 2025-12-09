import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center space-x-1.5 p-4 bg-white/5 backdrop-blur-sm rounded-2xl rounded-tl-none w-fit border border-white/5">
      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
    </div>
  );
};

export default TypingIndicator;