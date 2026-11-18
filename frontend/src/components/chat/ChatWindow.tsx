import React, { useEffect, useRef } from 'react';
import { ArrowRight, BatteryCharging, Camera, FileText, Globe, Mail, Map, MessageCircle, Music, Sparkles, Sun, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentStore } from '../../stores/agentStore';
import { auth } from '../../lib/firebase';
import { MessageBubble } from './MessageBubble';
import { InputBar } from '../ui/InputBar';

const quickActions = [
  { title: 'Open Chrome', subtitle: 'Launch a browser window', command: 'Open Chrome', icon: Globe, tone: 'blue' },
  { title: 'Create a note', subtitle: 'Open a fresh note in Notepad', command: 'Open Notepad', icon: FileText, tone: 'green' },
  { title: 'Analyze a photo', subtitle: 'Use the camera or attach an image', command: 'Open the camera so I can analyze a photo', icon: Camera, tone: 'purple' },
  { title: 'Open Spotify', subtitle: 'Play music or control a playlist', command: 'Open Spotify', icon: Music, tone: 'green' },
  { title: 'Draft an email', subtitle: 'Create a new email draft', command: 'Open my email client', icon: Mail, tone: 'purple' },
  { title: 'Message on WhatsApp', subtitle: 'Open WhatsApp Desktop', command: 'Open WhatsApp', icon: MessageCircle, tone: 'green' },
  { title: 'Open Maps', subtitle: 'Search and navigate locations', command: 'Open Maps', icon: Map, tone: 'blue' },
];

export const ChatWindow: React.FC<{ dashboardMode?: boolean }> = ({ dashboardMode = false }) => {
  const { messages, sendMessage, systemMetrics, setActiveView, clearMessages, newChat, saveChat, sessionTtsEnabled, setSessionTtsEnabled } = useAgentStore();
  const sendFromDashboard = (command: string) => { setActiveView('chat'); sendMessage(command); };
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return <section className="nova-main-panel">
    <div className="nova-scroll-area">
      {dashboardMode ? <div className="nova-dashboard">
        <section className="nova-hero-card">
          <div className="nova-hero-glow" />
          <div className="nova-engine-label"><Sparkles size={14} /> NEXUS INTELLIGENCE ENGINE</div>
          <h1>Hello, {auth.currentUser?.displayName?.split(' ')[0] || 'User'} <span>👋</span></h1>
          <p>What would you like me to do today? I can launch apps, search the web, summarize files, play music, or understand photos.</p>
          <button className="nova-listening-btn" onClick={() => sendFromDashboard('Open the camera so I can ask a question about what I see.')}><i /> NEXUS ORB READY <b>Open Mic <ArrowRight size={14} /></b></button>
        </section>
        <section className="nova-system-cards">
          <div className="nova-system-card"><div><span className="nova-stat-icon blue"><Volume2 size={20} /></span><p><strong>CPU Usage</strong><small>Live processor load</small></p></div><b>{systemMetrics?.cpu_percent ?? '—'}%</b><i><em style={{ width: `${systemMetrics?.cpu_percent ?? 0}%` }} /></i></div>
          <div className="nova-system-card"><div><span className="nova-stat-icon purple"><Sun size={20} /></span><p><strong>Memory</strong><small>{systemMetrics ? `${systemMetrics.memory_used_gb} GB of ${systemMetrics.memory_total_gb} GB used` : 'Loading live memory data'}</small></p></div><b>{systemMetrics?.memory_percent ?? '—'}%</b><i><em style={{ width: `${systemMetrics?.memory_percent ?? 0}%` }} /></i></div>
          <div className="nova-system-card power"><div><span className="nova-stat-icon green"><BatteryCharging size={20} /></span><p><strong>Battery</strong><small>{systemMetrics?.battery_plugged === null || systemMetrics?.battery_plugged === undefined ? 'Battery status unavailable' : systemMetrics.battery_plugged ? 'Connected to charger' : 'On battery power'}</small></p></div><b>{systemMetrics?.battery_percent ?? '—'}%<small>{systemMetrics?.battery_plugged ? 'Charging' : 'Live status'}</small></b></div>
          <div className="nova-system-card"><div><span className="nova-stat-icon blue"><FileText size={20} /></span><p><strong>Storage</strong><small>{systemMetrics ? `${systemMetrics.disk_used_gb} GB of ${systemMetrics.disk_total_gb} GB used` : 'Loading live storage data'}</small></p></div><b>{systemMetrics?.disk_percent ?? '—'}%</b><i><em style={{ width: `${systemMetrics?.disk_percent ?? 0}%` }} /></i></div>
        </section>
        <section><h2 className="nova-section-title">Quick Actions</h2><div className="nova-quick-grid">{quickActions.map(({ title, subtitle, command, icon: Icon, tone }) => <button key={title} className={`nova-quick-card ${tone}`} onClick={() => sendFromDashboard(command)}><Icon size={19} /><strong>{title}</strong><span>{subtitle}</span></button>)}</div></section>
      </div> : <div className="nova-chat-thread">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #242631' }}>
          <h2 style={{ fontSize: 14, color: '#a3a8b7', margin: 0 }}>Active Conversation</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Session TTS mute/unmute toggle — persists until new chat or app restart */}
            <button
              onClick={() => { setSessionTtsEnabled(!sessionTtsEnabled); }}
              title={sessionTtsEnabled ? 'Mute TTS for this chat' : 'Unmute TTS for this chat'}
              style={{
                background: sessionTtsEnabled ? 'rgba(115,103,240,0.15)' : '#1c1e26',
                border: `1px solid ${sessionTtsEnabled ? '#7367f0' : '#2a2c37'}`,
                color: sessionTtsEnabled ? '#7367f0' : '#a3a8b7',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.2s',
              }}
            >
              {sessionTtsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {sessionTtsEnabled ? 'TTS On' : 'TTS Off'}
            </button>
            <button onClick={clearMessages} style={{ background: '#1c1e26', border: '1px solid #2a2c37', color: '#a3a8b7', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Clear</button>
            <button onClick={newChat} style={{ background: '#1c1e26', border: '1px solid #2a2c37', color: '#a3a8b7', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>New Chat</button>
            <button onClick={() => { saveChat(); toast.success('Chat saved to history!'); }} style={{ background: '#7367f0', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Save Chat</button>
          </div>
        </div>
        {messages.length ? messages.map(message => <MessageBubble key={message.id} message={message} />) : <p className="chat-empty-state">Start a conversation with NexusAI.</p>}
      </div>}
      <div ref={bottomRef} />
    </div>
    <InputBar />
  </section>;
};
