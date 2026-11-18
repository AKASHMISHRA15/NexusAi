import React from 'react';
import { Bot, User, Copy, RefreshCw, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAgentStore } from '../../stores/agentStore';

// Defined locally to avoid Vite cache module resolution issues
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Props {
  message: Message;
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  const { sessionTtsEnabled } = useAgentStore();
  
  // Format timestamp (e.g. 10:42 AM)
  const timeStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(new Date(message.timestamp));
  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(message.content); toast.success('Response copied'); }
    catch { toast.error('Could not copy the response'); }
  };
  // Manual read-aloud: always works regardless of session mute state (explicit user action).
  const readMessage = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.content);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Microsoft Mark') || v.name.includes('Google UK English Male')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  };

  React.useEffect(() => {
    // If it's an assistant message, it's newly created (within 2 seconds), and session TTS is enabled, auto-read it.
    if (!isUser && sessionTtsEnabled && Date.now() - message.timestamp < 2000) {
      readMessage();
    }
  }, []); // Only run on initial mount of the message bubble

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`message ${isUser ? 'user flex-row-reverse' : 'assistant'}`}
    >
      <div className={`message-avatar ${isUser ? 'bg-gradient-to-tr from-accent-primary to-accent-secondary' : 'glass-accent border-accent-primary/30'}`}>
        {isUser ? <User size={18} className="text-white" /> : <Bot size={18} className="text-accent-primary" />}
      </div>
      
      <div className="message-content group">
        <div className={`message-bubble ${isUser ? 'bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 border-accent-primary/30 text-white shadow-glow' : 'glass border-white/5'}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
              <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
            </div>
          )}
        </div>
        <div className={`message-time flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {timeStr}
          {!isUser && (
            <div className="message-actions opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button onClick={() => void copyMessage()} title="Copy"><Copy size={14} /></button>
              <button onClick={readMessage} title="Read Aloud"><Volume2 size={14} /></button>
              <button title="Regenerate"><RefreshCw size={14} /></button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
