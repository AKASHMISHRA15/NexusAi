import React from 'react';
import { LayoutDashboard, Mic, MessageSquare, Box, FolderOpen, Globe, Mail, MessageCircle, Music, Map, CloudSun, Settings, Zap, HardDrive, History, Terminal, MonitorPlay } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';

const utilityItems = [
  { icon: Mic, label: 'Voice Assistant', view: 'voice' as const, voice: true }, { icon: MessageSquare, label: 'Chat Assistant', view: 'chat' as const },
  { icon: FolderOpen, label: 'Files Explorer', view: 'files' as const },
  { icon: MonitorPlay, label: 'Nexus Multimedia', view: 'nexus-view' as const },
  { icon: Globe, label: 'Web Browser', view: 'browser' as const }, { icon: Mail, label: 'Email Client', view: 'email' as const },
  { icon: MessageCircle, label: 'WhatsApp', view: 'whatsapp' as const }, { icon: Music, label: 'Music Player', view: 'music' as const }, { icon: Map, label: 'Maps', view: 'maps' as const },
  { icon: CloudSun, label: 'Weather', view: 'weather' as const },
];

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, isSettingsOpen, setSettingsOpen, systemMetrics } = useAgentStore();
  const goDashboard = () => { setActiveView('dashboard'); setSettingsOpen(false); };
  const openView = (view: typeof activeView, voice = false) => {
    setActiveView(view); setSettingsOpen(false);
    if (voice) window.dispatchEvent(new Event('nexus:start-voice'));
  };

  return <aside className="nova-sidebar">
    <button className="nova-brand" onClick={goDashboard} aria-label="NexusAI dashboard">
      <span className="nova-brand-icon">N</span><span><strong>NEXUS<span>AI</span></strong><small>OS ASSISTANT</small></span>
    </button>
    <nav className="nova-nav" aria-label="Workspace navigation">
      <button className={`nova-nav-item ${activeView === 'dashboard' && !isSettingsOpen ? 'active' : ''}`} onClick={goDashboard}><LayoutDashboard size={18} /> Dashboard</button>
      {utilityItems.slice(0, 2).map(({ icon: Icon, label, view, voice }) => <button className={`nova-nav-item ${activeView === view && !isSettingsOpen ? 'active' : ''}`} key={label} onClick={() => openView(view, voice)}><Icon size={18} /> {label}</button>)}
      <button className={`nova-nav-item ${activeView === 'skills' && !isSettingsOpen ? 'active' : ''}`} onClick={() => { setActiveView('skills'); setSettingsOpen(false); }}><Box size={18} /> Skill Modules</button>
      {utilityItems.slice(2).map(({ icon: Icon, label, view }) => <button className={`nova-nav-item ${activeView === view && !isSettingsOpen ? 'active' : ''}`} key={label} onClick={() => openView(view)}><Icon size={18} /> {label}</button>)}
      <button className={`nova-nav-item ${activeView === 'history' && !isSettingsOpen ? 'active' : ''}`} onClick={() => openView('history')}><History size={18} /> Chat History</button>
      <button className={`nova-nav-item ${isSettingsOpen ? 'active' : ''}`} onClick={() => setSettingsOpen(true)}><Settings size={18} /> Settings</button>
      <button className={`nova-nav-item ${activeView === 'logs' ? 'active' : ''}`} onClick={() => openView('logs')}><Terminal size={18} /> System Logs</button>
    </nav>
    <div className="nova-sidebar-footer">
      <div className="nova-storage"><span><HardDrive size={13} /> Storage</span><small>{systemMetrics ? `${systemMetrics.disk_used_gb} GB / ${systemMetrics.disk_total_gb} GB` : 'Loading...'}</small><i><b style={{ width: `${systemMetrics?.disk_percent ?? 0}%` }} /></i></div>
      <div className="nova-profile"><span className="nova-profile-icon"><Zap size={17} /></span><span><strong>Akash Mishra</strong><small>v1.4.0-nexus</small></span></div>
    </div>
  </aside>;
};
