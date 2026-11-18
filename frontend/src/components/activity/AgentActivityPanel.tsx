import React, { useEffect, useRef } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { Terminal, Square, CheckCircle2, XCircle, ChevronRight, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AgentActivityPanel: React.FC = () => {
  const { activityStream, isAgentActive, activeTaskIds, cancelAllTasks } = useAgentStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityStream, isAgentActive]);

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <div className="activity-title">
          <Terminal size={14} />
          <span>Agent Activity</span>
        </div>
        <div className={`activity-title-dot ${isAgentActive ? 'active' : 'idle'}`} />
        {isAgentActive && <button className="stop-tasks-btn" onClick={cancelAllTasks} title="Stop all active tasks"><Square size={11} /> Stop ({activeTaskIds.length})</button>}
      </div>
      
      <div className="terminal-window glass border-white/5 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-[2px] before:bg-white/5">
        {activityStream.length === 0 && !isAgentActive ? (
          <div className="terminal-idle text-text-muted flex items-center gap-2 pl-2"><Clock size={14}/> Waiting for task...</div>
        ) : (
          <AnimatePresence>
            {activityStream.map((event) => (
              <motion.div 
                key={event.id} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="terminal-line relative pl-8 py-2 pr-2 group flex flex-col gap-1"
              >
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 border-bg-surface
                  ${event.type === 'tool_start' ? 'bg-accent-primary text-white shadow-glow' : 
                    event.type === 'tool_end' && event.success ? 'bg-green-500 text-white' : 
                    event.type === 'tool_end' && !event.success ? 'bg-red-500 text-white' : 
                    event.type === 'error' ? 'bg-red-500 text-white' :
                    event.type === 'done' ? 'bg-green-500 text-white' : 'bg-bg-highlight text-text-muted'}
                `}>
                  {event.type === 'tool_end' && event.success && <CheckCircle2 size={12} strokeWidth={3} />}
                  {event.type === 'tool_end' && !event.success && <XCircle size={12} strokeWidth={3} />}
                  {event.type === 'tool_start' && <ChevronRight size={12} strokeWidth={3} />}
                  {event.type === 'error' && <XCircle size={12} strokeWidth={3} />}
                  {event.type === 'done' && <CheckCircle2 size={12} strokeWidth={3} />}
                </div>
                
                <span className={`terminal-text text-sm pr-2 break-words ${event.type === 'tool_end' ? (event.success ? 'text-green-400' : 'text-red-400') : 'text-text-primary group-hover:text-white transition-colors'}`}>
                  {event.message || event.text}
                </span>
                
                <span className="text-[10px] text-text-muted opacity-60 group-hover:opacity-100 transition-opacity">
                  {new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        
        {isAgentActive && (
          <div className="terminal-thinking mt-2">
            <span>Processing {activeTaskIds.length} task{activeTaskIds.length === 1 ? '' : 's'}</span>
            <div className="thinking-dots">
              <div className="thinking-dot" />
              <div className="thinking-dot" />
              <div className="thinking-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
