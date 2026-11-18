import React, { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, Sparkles, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

interface TranscriptEntry {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const VoiceAssistantUI: React.FC = () => {
  const [assistantState, setAssistantState] = useState<AssistantState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  
  const { sendMessage, messages } = useAgentStore();
  const recognitionRef = useRef<any>(null);
  const lastMessageCount = useRef(messages.length);

  const addTranscript = (sender: 'user' | 'ai', text: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTranscript((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(7), sender, text, timestamp: timeString }
    ]);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = () => {
          setAssistantState('listening');
        };

        recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          addTranscript('user', text);
          setAssistantState('processing');
          sendMessage(text);
        };
        
        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setAssistantState('idle');
        };
        
        recognition.onend = () => {
          // If we were listening and it ended without processing, go back to idle
          setAssistantState(prev => prev === 'listening' ? 'idle' : prev);
        };
        
        recognitionRef.current = recognition;
      }
    }
    
    return () => {
      window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }
    };
  }, [sendMessage]);

  // Listen for new assistant messages
  useEffect(() => {
    if (messages.length > lastMessageCount.current) {
      const latestMsg = messages[messages.length - 1];
      if (latestMsg.role === 'assistant') {
        addTranscript('ai', latestMsg.content);
        setAssistantState('speaking');
        
        // Use Speech Synthesis to read the response
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(latestMsg.content);
        utterance.onend = () => setAssistantState('idle');
        utterance.onerror = () => setAssistantState('idle');
        window.speechSynthesis.speak(utterance);
      }
      lastMessageCount.current = messages.length;
    }
  }, [messages]);

  const handleOrbClick = () => {
    if (assistantState === 'idle') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.error("Failed to start recognition:", err);
        }
      } else {
        alert("Speech Recognition API is not supported in this browser. Try Chrome.");
      }
    } else {
      // Cancel everything
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }
      window.speechSynthesis.cancel();
      setAssistantState('idle');
    }
  };

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [transcript]);

  const getStatusText = () => {
    switch (assistantState) {
      case 'idle': return 'Tap Orb to speak';
      case 'listening': return 'Listening...';
      case 'processing': return 'Analyzing...';
      case 'speaking': return 'Speaking...';
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
    flex: 1, minHeight: '600px', maxWidth: '640px', margin: '0 auto', padding: '2rem',
    boxSizing: 'border-box', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff',
  };

  const headerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem' };
  const badgeStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.75rem', borderRadius: '9999px', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '0.875rem', fontWeight: 600 };
  const titleStyle: React.CSSProperties = { fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 0 0', background: 'linear-gradient(to right, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
  const subtitleStyle: React.CSSProperties = { color: '#9ca3af', margin: 0, fontSize: '1rem' };
  const orbContainerStyle: React.CSSProperties = { position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '250px', height: '250px' };
  const orbStyle: React.CSSProperties = { position: 'relative', zIndex: 10, width: '144px', height: '144px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', border: '2px solid', transition: 'all 0.5s ease' };

  const getOrbStateStyles = () => {
    switch (assistantState) {
      case 'idle': return { background: 'rgba(20, 22, 27, 0.7)', borderColor: 'rgba(255, 255, 255, 0.08)', boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)' };
      case 'listening': return { background: 'linear-gradient(135deg, #22d3ee, #3b82f6, #4f46e5)', borderColor: '#22d3ee', boxShadow: '0 0 40px rgba(59, 130, 246, 0.6)' };
      case 'processing': return { background: 'linear-gradient(135deg, #a855f7, #ec4899, #4f46e5)', borderColor: '#ec4899', boxShadow: '0 0 40px rgba(236, 72, 153, 0.6)' };
      case 'speaking': return { background: 'linear-gradient(135deg, #7c3aed, #4338ca)', borderColor: '#7c3aed', boxShadow: '0 0 40px rgba(124, 58, 237, 0.6)' };
    }
  };

  const statusTextStyle: React.CSSProperties = { marginTop: '1.5rem', fontSize: '1.125rem', fontWeight: 500, color: '#d1d5db', textAlign: 'center', minHeight: '1.5rem' };
  const logPanelStyle: React.CSSProperties = { width: '100%', height: '220px', backgroundColor: 'rgba(20, 22, 27, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '1rem', padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxSizing: 'border-box' };
  const entryStyle = (sender: 'user' | 'ai'): React.CSSProperties => ({ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: sender === 'user' ? 'rgba(34, 211, 238, 0.05)' : 'rgba(168, 85, 247, 0.05)', borderLeft: `3px solid ${sender === 'user' ? '#22d3ee' : '#a855f7'}`, gap: '0.25rem' });
  const entryHeaderStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#9ca3af' };
  const entryHeaderLeftStyle = (sender: 'user' | 'ai'): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: '0.25rem', color: sender === 'user' ? '#22d3ee' : '#a855f7', fontWeight: 600, textTransform: 'uppercase' });
  const entryTextStyle: React.CSSProperties = { fontSize: '0.95rem', lineHeight: 1.5, color: '#f3f4f6' };

  const renderListeningDecorators = () => (
    <>
      <motion.div animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', width: '144px', height: '144px', borderRadius: '50%', border: '2px solid #22d3ee' }} />
      <motion.div animate={{ scale: [1, 2.5, 1], opacity: [0.2, 0, 0.2] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} style={{ position: 'absolute', width: '144px', height: '144px', borderRadius: '50%', border: '1px solid #3b82f6' }} />
    </>
  );

  const renderProcessingDecorators = () => (
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', width: '170px', height: '170px', borderRadius: '50%', border: '2px dashed #ec4899', opacity: 0.8 }} />
  );

  const renderSpeakingDecorators = () => {
    const bars = Array.from({ length: 15 });
    return (
      <div style={{ position: 'absolute', width: '220px', height: '220px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {bars.map((_, i) => (
          <div key={i} style={{ position: 'absolute', transform: `rotate(${(i / bars.length) * 360}deg) translateY(-85px)`, transformOrigin: '50% 100%' }}>
            <motion.div animate={{ height: ['10px', `${20 + Math.random() * 30}px`, '10px'] }} transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, ease: 'easeInOut' }} style={{ width: '6px', borderRadius: '3px', background: 'linear-gradient(to top, #8b5cf6, #5b8cff)' }} />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={badgeStyle}><Sparkles size={16} /> Nova Speech Synthesizer</div>
        <h1 style={titleStyle}>Interactive Voice Assistant</h1>
        <p style={subtitleStyle}>Advanced neural audio processing interface</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={orbContainerStyle}>
          {assistantState === 'listening' && renderListeningDecorators()}
          {assistantState === 'processing' && renderProcessingDecorators()}
          {assistantState === 'speaking' && renderSpeakingDecorators()}
          
          <motion.div style={{ ...orbStyle, ...getOrbStateStyles() }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleOrbClick} animate={assistantState === 'speaking' ? { scale: [1, 1.08, 1], transition: { duration: 1.5, repeat: Infinity } } : {}}>
            {assistantState === 'idle' ? <Mic size={48} color="#9ca3af" /> : assistantState === 'speaking' ? <Volume2 size={48} color="#fff" /> : <Mic size={48} color="#fff" />}
          </motion.div>
        </div>
        <motion.div key={assistantState} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={statusTextStyle}>{getStatusText()}</motion.div>
      </div>

      <div style={logPanelStyle} ref={logRef}>
        <AnimatePresence>
          {transcript.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', gap: '0.5rem' }}>
              <Terminal size={24} />
              <span>System ready. Waiting for input...</span>
            </div>
          ) : (
            transcript.map((entry) => (
              <motion.div key={entry.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={entryStyle(entry.sender)}>
                <div style={entryHeaderStyle}>
                  <div style={entryHeaderLeftStyle(entry.sender)}>
                    {entry.sender === 'user' ? <Mic size={12} /> : <Volume2 size={12} />}
                    {entry.sender === 'user' ? 'User' : 'Nova AI'}
                  </div>
                  <span>{entry.timestamp}</span>
                </div>
                <div style={entryTextStyle}>{entry.text}</div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
