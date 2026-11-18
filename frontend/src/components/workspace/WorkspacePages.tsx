import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, File, Folder, Globe2, Image as ImageIcon, Mail, MapPin, MessageCircle, MonitorPlay, Music2, Pencil, Play, Search, Send, Video, XCircle, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentStore } from '../../stores/agentStore';
import { FileContentPanel } from './FolderViewer';
import { MusicPlayerUI } from './MusicPlayerUI';
import { MapsMockUI } from './MapsMockUI';
import { EmailClientUI } from './EmailClientUI';
import { VoiceAssistantUI } from './VoiceAssistantUI';
import { WeatherPage } from './WeatherPage';
import { desktopDir, documentDir, downloadDir, pictureDir, audioDir, videoDir, join, dirname } from '@tauri-apps/api/path';
import { readDir } from '@tauri-apps/plugin-fs';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { listen } from '@tauri-apps/api/event';

const api = 'http://127.0.0.1:8765/api';

const launch = async (appName: string) => {
  try {
    const response = await fetch(`${api}/launch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_name: appName }) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.output || 'Could not launch the app.');
    toast.success(result.output || `Opened ${appName}`);
  } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not launch the app.'); }
};

export const FileExplorerPage: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Smart Action Menu state
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, file: any} | null>(null);

  const { sendMessage, setActiveView } = useAgentStore();

  const locations = [
    { id: 'desktop', label: 'Desktop', icon: Folder, getDir: desktopDir },
    { id: 'documents', label: 'Documents', icon: Folder, getDir: documentDir },
    { id: 'downloads', label: 'Downloads', icon: Folder, getDir: downloadDir },
    { id: 'pictures', label: 'Pictures', icon: ImageIcon, getDir: pictureDir },
    { id: 'music', label: 'Music', icon: Music2, getDir: audioDir },
    { id: 'videos', label: 'Videos', icon: Video, getDir: videoDir }
  ];

  const loadDirectory = async (path: string) => {
    setLoading(true); setError('');
    try {
      const entries = await readDir(path);
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(sorted);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.message || 'Could not read directory.');
    } finally {
      setLoading(false);
    }
  };

  const goToQuickAccess = async (getDir: () => Promise<string>) => {
    try {
      const path = await getDir();
      setHistory(prev => [...prev, currentPath].filter(Boolean));
      loadDirectory(path);
    } catch (e) {
      toast.error('Could not access this directory.');
    }
  };

  useEffect(() => { goToQuickAccess(desktopDir); }, []);

  const handleBack = async () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      loadDirectory(prev);
    } else if (currentPath) {
      try {
        const parent = await dirname(currentPath);
        if (parent && parent !== currentPath) loadDirectory(parent);
      } catch {}
    }
  };

  const openCurrentPathInWindows = async () => {
    if (!currentPath) return;
    try {
      const response = await fetch(`${api}/open-path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, is_folder: true })
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Opened in Windows');
      } else {
        toast.error(result.output || 'Could not open item in Windows.');
      }
    } catch (e: any) {
      toast.error('Failed to open in Windows: ' + e.message);
    }
  };

  const handleFileClick = async (file: any, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const fullPath = await join(currentPath, file.name);
    if (file.isDirectory) {
      setHistory(prev => [...prev, currentPath]);
      loadDirectory(fullPath);
    } else {
      setContextMenu({ x: e.clientX, y: e.clientY, file: { ...file, fullPath } });
    }
  };

  const handleRightClick = async (file: any, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const fullPath = await join(currentPath, file.name);
    setContextMenu({ x: e.clientX, y: e.clientY, file: { ...file, fullPath } });
  };

  const openInViewer = () => {
    if (!contextMenu) return;
    const { file } = contextMenu;
    const ext = file.name.split('.').pop()?.toLowerCase();
    let type = 'unknown';
    if (file.isDirectory) type = 'folder';
    else if (['mp4', 'webm', 'ogg'].includes(ext!)) type = 'video';
    else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext!)) type = 'image';
    else if (['mp3', 'wav', 'ogg'].includes(ext!)) type = 'audio';
    else if (ext === 'pdf') type = 'pdf';
    else if (['txt', 'json', 'md', 'ts', 'tsx', 'js', 'jsx', 'csv', 'py', 'html', 'css', 'cpp', 'c', 'java', 'rs', 'go'].includes(ext!)) type = 'text';

    if (type !== 'unknown') {
      useAgentStore.getState().setNexusView({ path: file.fullPath, type, name: file.name });
      setActiveView('nexus-view');
    } else {
      toast.error('File type not supported for internal viewing. Opening externally.');
      shellOpen(file.fullPath);
    }
    setContextMenu(null);
  };

  const openExternally = async () => { 
    if (contextMenu) {
      try {
        const response = await fetch(`${api}/open-path`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: contextMenu.file.fullPath, is_folder: contextMenu.file.isDirectory })
        });
        const result = await response.json();
        if (result.success) {
          toast.success('Opened in Windows');
        } else {
          toast.error(result.output || 'Could not open item in Windows.');
        }
      } catch (e: any) {
        toast.error('Failed to open in Windows: ' + e.message);
      }
    }
    setContextMenu(null); 
  };
  
  const sendToAI = () => {
    if (contextMenu) {
      setActiveView('chat');
      const isDir = contextMenu.file.isDirectory;
      if (isDir) {
        sendMessage(`I am looking at this folder: ${contextMenu.file.fullPath} — please list its contents and summarise what's inside using your tools.`);
      } else {
        sendMessage(`I am looking at this file: ${contextMenu.file.fullPath} — please tell me what kind of file it is and anything useful about it.`);
      }
    }
    setContextMenu(null);
  };

  return (
    <section className="workspace-page file-page" onClick={() => contextMenu && setContextMenu(null)}>
      <header>
        <div>
          <p className="eyebrow">NATIVE OS NAVIGATOR</p>
          <h1>File Explorer</h1>
          <span>Browse your local files and view multimedia natively inside Nexus AI.</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="page-action" onClick={handleBack} disabled={!currentPath}><ArrowLeft size={16} style={{ marginRight: 6 }}/> Back</button>
          <button className="page-action" onClick={openCurrentPathInWindows} disabled={!currentPath}>💻 Open in Windows</button>
        </div>
      </header>

      <div className="file-layout">
        <aside>
          <p className="file-rail-title">QUICK ACCESS</p>
          {locations.map(({ id, label, icon: Icon, getDir }) => (
            <button onClick={() => goToQuickAccess(getDir)} key={id}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </aside>

        <div className="file-content">
          <div className="file-content-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#aaa', wordBreak: 'break-all' }}>{currentPath || 'Loading...'}</span>
            <small>{files.length} items</small>
          </div>
          
          <div className="file-grid" style={{ overflowY: 'auto' }}>
            {loading ? <p>Loading files…</p> : error ? <p>{error}</p> : files.length ? files.map(file => (
              <article key={file.name} className="file-tile" onClick={(e) => handleFileClick(file, e)} onContextMenu={(e) => handleRightClick(file, e)}>
                <span>{file.isDirectory ? <Folder color="#5B8CFF"/> : <File color="#aaa"/>}</span>
                <strong>{file.name}</strong>
                <small>{file.isDirectory ? 'Folder' : 'File'}</small>
              </article>
            )) : <p>This folder is empty.</p>}
          </div>
        </div>
      </div>

      {contextMenu && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, padding: 4, zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', minWidth: 180 }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #333', fontSize: 12, fontWeight: 700, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contextMenu.file.name}</div>
          <button onClick={openInViewer} style={{ background: 'none', border: 'none', padding: '10px 12px', color: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>👀 View inside Nexus AI</button>
          <button onClick={openExternally} style={{ background: 'none', border: 'none', padding: '10px 12px', color: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>💻 Open in Windows</button>
          <button onClick={sendToAI} style={{ background: 'none', border: 'none', padding: '10px 12px', color: '#5B8CFF', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>✨ Send to AI Chat</button>
        </div>
      )}
    </section>
  );
};

export const BrowserPage: React.FC = () => {
  const { browserSearchQuery, setBrowserSearchQuery } = useAgentStore();
  const [query, setQuery] = useState(browserSearchQuery || ''); 
  const [results, setResults] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  
  const search = async (searchStr: string) => { 
    if (!searchStr.trim()) return; 
    setLoading(true); 
    try { 
      const response = await fetch(`${api}/web-search?q=${encodeURIComponent(searchStr)}`); 
      const data = await response.json(); 
      setResults(data.results || []); 
    } finally { 
      setLoading(false); 
    } 
  };
  
  useEffect(() => {
    if (browserSearchQuery) {
      setQuery(browserSearchQuery);
      search(browserSearchQuery);
      setBrowserSearchQuery(''); // clear it so it doesn't loop
    }
  }, [browserSearchQuery, setBrowserSearchQuery]);
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };
  
  return <section className="workspace-page browser-page"><header><div><p className="eyebrow">LIVE WEB SEARCH</p><h1><Globe2 /> Nexus Browser</h1><span>Search the web without leaving your workspace.</span></div><div style={{display: 'flex', gap: '8px'}}><button className="page-action" onClick={() => void launch('Chrome')}>Open Chrome</button><button className="page-action" onClick={() => void launch('Edge')}>Open Edge</button></div></header><form className="workspace-search" onSubmit={handleSearchSubmit}><Search size={19}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search current news, places, or anything else..."/><button>{loading ? 'Searching…' : 'Search'}</button></form><div className="search-results">{results.length ? results.map((result, index) => <article key={result.url || index} onClick={() => window.open(result.url, '_blank', 'noopener,noreferrer')}><small>{result.source || 'Web result'}</small><h2>{result.title}</h2><p>{result.snippet}</p><em>{result.url}</em></article>) : <p className="page-empty">Enter a search above to get live web results.</p>}</div></section>;
};

const IntegrationPage: React.FC<{ kind: 'email' | 'whatsapp' | 'music' | 'maps' }> = ({ kind }) => {
  const details = { email: ['Email Client', 'Open your configured mail app and draft messages with NexusAI.', 'outlook', Mail], whatsapp: ['WhatsApp', 'Open WhatsApp Desktop. Your private chats stay inside WhatsApp; NexusAI only acts when you ask.', 'whatsapp', MessageCircle], music: ['Music Player', 'Launch Spotify and let NexusAI help find music or control playback.', 'spotify', Music2], maps: ['Maps', 'Open maps in your browser and search for a destination.', 'chrome', MapPin] } as const;
  const [title, description, appName, Icon] = details[kind];

  const renderUI = () => {
    switch (kind) {
      case 'music': return <MusicPlayerUI />;
      case 'maps': return <MapsMockUI />;
      case 'email': return <EmailClientUI />;
      case 'whatsapp': return null;
    }
  };

  return <section className="workspace-page integration-page"><div className="integration-hero"><span><Icon size={30}/></span><p className="eyebrow">DEVICE INTEGRATION</p><h1>{title}</h1><p>{description}</p><button className="page-action" onClick={() => void launch(appName)}>{kind === 'music' ? <Play size={17}/> : <Send size={17}/>} Open {title}</button></div><div className="integration-notice"><CheckCircle2 size={20}/><div><strong>Ready when you are</strong><p>This button opens the real signed-in application on your device. Private chats and accounts remain inside that application.</p></div></div><div style={{ marginTop: '24px' }}>{renderUI()}</div></section>;
};

export const LogsPage: React.FC = () => {
  const { activityStream, clearActivityStream } = useAgentStore();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  // Group activity events by taskId into "task sessions"
  const taskGroups = React.useMemo(() => {
    const groups: Record<string, { taskId: string; events: typeof activityStream; startTime: number; endTime: number; success: boolean; summary: string; module: string }> = {};
    for (const event of activityStream) {
      const key = event.taskId || 'global';
      if (!groups[key]) {
        groups[key] = { taskId: key, events: [], startTime: event.timestamp, endTime: event.timestamp, success: true, summary: '', module: 'System' };
      }
      groups[key].events.push(event);
      groups[key].endTime = Math.max(groups[key].endTime, event.timestamp);
      if (event.type === 'error') groups[key].success = false;
      if (event.type === 'done' && event.message) groups[key].summary = event.message;
      if (event.type === 'tool_end' && event.message) { groups[key].summary = event.message; groups[key].module = event.tool || 'System'; }
    }
    return Object.values(groups).sort((a, b) => b.startTime - a.startTime);
  }, [activityStream]);

  const selectedGroup = taskGroups.find(g => g.taskId === selectedTask);

  const getModuleLabel = (module: string) => {
    const map: Record<string, string> = { open_application: 'App Launcher', open_edge: 'Browser', open_chrome: 'Browser', search_web: 'Web Search', search_files: 'File System', open_nexus_panel: 'UI Panel', send_whatsapp: 'WhatsApp', print_file: 'Printer', close_application: 'App Closer' };
    return map[module] || module.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'AI Engine';
  };

  const getEventTypeLabel = (type: string) => ({ thinking: 'Planning', tool_start: 'Executing', tool_end: 'Result', done: 'Complete', error: 'Error', stream: 'Response' }[type] || type);

  return (
    <section className="workspace-page logs-page">
      <header>
        <div>
          <p className="eyebrow">SYSTEM LOGS</p>
          <h1>Command History</h1>
          <span>Real-time execution trace for this NexusAI session.</span>
        </div>
        <button className="page-action danger" onClick={() => { clearActivityStream(); setSelectedTask(null); }}>Clear History</button>
      </header>

      {taskGroups.length === 0 ? (
        <p className="page-empty">No activity has been recorded in this session yet.</p>
      ) : (
        <div className="logs-table-wrapper">
          <div className="logs-table-header">
            <span>TIMESTAMP</span>
            <span>MODULE</span>
            <span>COMMAND ACTION</span>
            <span>STATUS</span>
            <span>LATENCY</span>
          </div>
          <div className="logs-table-body">
            {taskGroups.map(group => {
              const latencyMs = group.endTime - group.startTime;
              const latency = latencyMs < 1000 ? `${latencyMs}ms` : `${(latencyMs / 1000).toFixed(1)}s`;
              const timeLabel = new Date(group.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
              const summary = group.summary || group.events.find(e => e.type === 'tool_end')?.message || group.events.find(e => e.message)?.message || 'Task complete';
              const module = getModuleLabel(group.module);
              return (
                <div key={group.taskId} className="logs-table-row" onClick={() => setSelectedTask(group.taskId === selectedTask ? null : group.taskId)}>
                  <span className="log-time">{timeLabel}</span>
                  <span className="log-module-badge">{module}</span>
                  <span className="log-summary">{summary}</span>
                  <span className={`log-status-badge ${group.success ? 'success' : 'error'}`}>{group.success ? '✓ Success' : '✗ Error'}</span>
                  <span className="log-latency">{latency}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedGroup && (
        <div className="log-detail-overlay" onClick={() => setSelectedTask(null)}>
          <div className="log-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="log-detail-header">
              <div>
                <h3>{selectedGroup.summary || 'Task Detail'}</h3>
                <small>{new Date(selectedGroup.startTime).toLocaleTimeString()} — {((selectedGroup.endTime - selectedGroup.startTime) / 1000).toFixed(2)}s total</small>
              </div>
              <button className="log-detail-close" onClick={() => setSelectedTask(null)}><X size={16}/></button>
            </div>
            <div className="log-detail-steps">
              {selectedGroup.events.map((event) => {
                const relativeMs = event.timestamp - selectedGroup.startTime;
                return (
                  <div key={event.id} className={`log-step ${event.type === 'error' ? 'step-error' : event.type === 'done' ? 'step-done' : 'step-normal'}`}>
                    <div className="log-step-dot" />
                    <div className="log-step-body">
                      <span className="log-step-label">{getEventTypeLabel(event.type)}{event.tool ? `: ${event.tool.replace(/_/g, ' ')}` : ''}</span>
                      <span className="log-step-msg">{event.message}</span>
                    </div>
                    <span className="log-step-time">+{relativeMs < 1000 ? `${relativeMs}ms` : `${(relativeMs / 1000).toFixed(2)}s`}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export const EmailPage = () => <IntegrationPage kind="email"/>;
export const WhatsAppPage = () => <IntegrationPage kind="whatsapp"/>;
export const MusicPage = () => {
  return (
    <section className="workspace-page" style={{ padding: 0 }}>
      <header style={{ padding: '24px 28px 0' }}>
        <div>
          <p className="eyebrow">SPOTIFY INTEGRATION</p>
          <h1>Music Player</h1>
          <span>Your real Spotify library — playlists, followed artists, and search.</span>
        </div>
        <button className="page-action" onClick={() => void launch('spotify')}>
          Open Spotify App
        </button>
      </header>
      <div style={{ padding: '20px 28px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <MusicPlayerUI />
      </div>
    </section>
  );
};
// ── Canvas / Editor Page ─────────────────────────────────────────────────────
// A VS Code–style workspace: folder tree on the left, view/edit on the right.
interface CanvasEditorProps {
  onClose: () => void;
  initialFilePath?: string;
  initialFileName?: string;
  initialFolderPath?: string;
  initialFolderName?: string;
  startInEditMode?: boolean;
}

// File type helpers
const IMAGE_EXTS = ['png','jpg','jpeg','gif','webp','bmp','svg'];
const VIDEO_EXTS = ['mp4','webm','ogg','mov','mkv'];
const AUDIO_EXTS = ['mp3','wav','ogg','flac','aac'];

type EditMode = 'text' | 'paint' | 'studio';

function getEditMode(fileName: string): EditMode {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTS.includes(ext)) return 'paint';
  if (VIDEO_EXTS.includes(ext)) return 'studio';
  return 'text';
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTS.includes(ext)) return '🖼️';
  if (VIDEO_EXTS.includes(ext)) return '🎬';
  if (AUDIO_EXTS.includes(ext)) return '🎵';
  if (ext === 'pdf') return '📕';
  if (['ts','tsx'].includes(ext)) return '🔷';
  if (['js','jsx'].includes(ext)) return '🟡';
  if (['py'].includes(ext)) return '🐍';
  if (['json'].includes(ext)) return '{}';
  if (['md'].includes(ext)) return '📝';
  if (['html','css'].includes(ext)) return '🌐';
  return '📄';
}

interface FileNode { name: string; path: string; isDirectory: boolean; children?: FileNode[]; isOpen?: boolean; }

const CanvasEditorPage: React.FC<CanvasEditorProps> = ({
  onClose, initialFilePath, initialFileName, initialFolderPath, initialFolderName, startInEditMode
}) => {
  const [tab, setTab] = React.useState<'view' | 'edit'>(startInEditMode ? 'edit' : 'view');
  const [editMode, setEditMode] = React.useState<EditMode>('text');
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Folder tree state
  const [folderPath, setFolderPath] = React.useState(initialFolderPath || '');
  const [folderName, setFolderName] = React.useState(initialFolderName || '');
  const [tree, setTree] = React.useState<FileNode[]>([]);

  // Selected file state
  const [selectedFile, setSelectedFile] = React.useState<FileNode | null>(() => {
    if (initialFilePath) {
      const name = initialFileName || initialFilePath.split(/[\\/]/).pop() || 'File';
      setEditMode(getEditMode(name));
      return { name, path: initialFilePath, isDirectory: false };
    }
    return null;
  });

  // Load folder tree whenever folderPath changes
  useEffect(() => {
    if (!folderPath) { setTree([]); return; }
    (async () => {
      try {
        const { readDir: rd } = await import('@tauri-apps/plugin-fs');
        const { join: j } = await import('@tauri-apps/api/path');
        const entries = await rd(folderPath);
        const nodes: FileNode[] = await Promise.all(
          entries.map(async (e: any) => ({ name: e.name, path: await j(folderPath, e.name), isDirectory: e.isDirectory }))
        );
        nodes.sort((a, b) => a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1);
        setTree(nodes);
      } catch (err) { console.error(err); }
    })();
  }, [folderPath]);

  // Tauri native drag-drop
  useEffect(() => {
    const handleDrop = (event: any) => {
      if (!event.payload?.paths?.length) return;
      const p = event.payload.paths[0];
      const name = p.split(/[\\/]/).pop() || 'Item';
      if (!name.includes('.') || name.indexOf('.') === 0) {
        setFolderPath(p); setFolderName(name); setSelectedFile(null);
      } else {
        setSelectedFile({ name, path: p, isDirectory: false });
        setEditMode(getEditMode(name));
      }
      setIsDragOver(false);
    };

    const unlistenDrop = listen<{ paths: string[] }>('tauri://drop', handleDrop);
    const unlistenFileDrop = listen<{ paths: string[] }>('tauri://file-drop', handleDrop);
    const unlistenDragDrop = listen<{ paths: string[] }>('tauri://drag-drop', handleDrop);
    
    listen('tauri://drag-enter', () => setIsDragOver(true));
    listen('tauri://drag-leave', () => setIsDragOver(false));

    return () => { 
      unlistenDrop.then(f => f()); 
      unlistenFileDrop.then(f => f());
      unlistenDragDrop.then(f => f());
    };
  }, []);

  const handleOpenFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: false, multiple: false });
      if (selected && typeof selected === 'string') {
        const name = selected.split(/[\\/]/).pop() || 'File';
        setSelectedFile({ name, path: selected, isDirectory: false });
        setEditMode(getEditMode(name));
      }
    } catch {}
  };

  const handleOpenFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        const name = selected.split(/[\\/]/).pop() || 'Folder';
        setFolderPath(selected); setFolderName(name); setSelectedFile(null);
      }
    } catch {}
  };

  // Recursively toggle folder open/close in tree
  const toggleNode = (nodes: FileNode[], targetPath: string): FileNode[] =>
    nodes.map(n => {
      if (n.path === targetPath && n.isDirectory) return { ...n, isOpen: !n.isOpen };
      if (n.children) return { ...n, children: toggleNode(n.children, targetPath) };
      return n;
    });

  const loadChildren = async (node: FileNode): Promise<FileNode[]> => {
    const { readDir: rd } = await import('@tauri-apps/plugin-fs');
    const { join: j } = await import('@tauri-apps/api/path');
    const entries = await rd(node.path);
    const children: FileNode[] = await Promise.all(
      entries.map(async (e: any) => ({ name: e.name, path: await j(node.path, e.name), isDirectory: e.isDirectory }))
    );
    children.sort((a, b) => a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1);
    return children;
  };

  const handleNodeClick = async (node: FileNode) => {
    if (node.isDirectory) {
      // lazy-load children
      if (!node.children) {
        try { node.children = await loadChildren(node); } catch {}
      }
      setTree(prev => toggleNode(prev, node.path));
    } else {
      setSelectedFile(node);
      setEditMode(getEditMode(node.name));
    }
  };

  // Render tree recursively
  const renderTree = (nodes: FileNode[], depth = 0): React.ReactNode =>
    nodes.map(node => (
      <React.Fragment key={node.path}>
        <div
          onClick={() => handleNodeClick(node)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: `4px 10px 4px ${10 + depth * 14}px`,
            cursor: 'pointer', borderRadius: 3,
            background: selectedFile?.path === node.path ? 'rgba(115,103,240,0.18)' : 'transparent',
            color: node.isDirectory ? '#8b82fd' : '#c9d1e0',
            fontSize: 12.5, userSelect: 'none',
            borderLeft: selectedFile?.path === node.path ? '2px solid #7367f0' : '2px solid transparent',
          }}
        >
          {node.isDirectory
            ? <span style={{ fontSize: 10, opacity: 0.7, width: 12, display: 'inline-block' }}>{node.isOpen ? '▼' : '▶'}</span>
            : <span style={{ width: 12 }}/>}
          <span style={{ fontSize: 13 }}>{node.isDirectory ? (node.isOpen ? '📂' : '📁') : getFileIcon(node.name)}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{node.name}</span>
        </div>
        {node.isDirectory && node.isOpen && node.children && renderTree(node.children, depth + 1)}
      </React.Fragment>
    ));

  // ── Edit mode content ─────────────────────────────────────────────────────
  const renderEdit = () => {
    if (!selectedFile) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexDirection: 'column', gap: 12 }}>
          <Pencil size={36} style={{ opacity: 0.25 }}/>
          <span style={{ fontSize: 13, color: '#666' }}>Select a file from the sidebar to edit</span>
        </div>
      );
    }
    return <FileContentPanel file={selectedFile} mode="edit" editMode={editMode} />;
  };

  // ── View mode content ─────────────────────────────────────────────────────
  const renderView = () => {
    if (!selectedFile && !folderPath) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          <div style={{
            textAlign: 'center', color: '#a3a8b7', maxWidth: 380, padding: 40,
            border: `2px dashed ${isDragOver ? '#7367f0' : '#2a2c37'}`,
            borderRadius: 20, transition: 'all 0.2s',
            background: isDragOver ? 'rgba(115,103,240,0.07)' : 'transparent'
          }}>
            <Eye size={44} style={{ margin: '0 auto 14px', display: 'block', opacity: isDragOver ? 1 : 0.25, color: isDragOver ? '#7367f0' : '#a3a8b7', transition: 'all 0.2s' }}/>
            <h3 style={{ color: '#e9edf5', margin: '0 0 8px', fontSize: 17 }}>{isDragOver ? '🎯 Drop to open!' : 'Drop a file or folder here'}</h3>
            <p style={{ fontSize: 12, lineHeight: 1.7, margin: 0, color: '#555' }}>
              Or use <strong style={{color:'#7367f0'}}>Open Folder</strong> / <strong style={{color:'#7367f0'}}>Open File</strong> in the toolbar above
            </p>
          </div>
        </div>
      );
    }
    if (!selectedFile) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexDirection: 'column', gap: 12 }}>
          <Eye size={36} style={{ opacity: 0.25 }}/>
          <span style={{ fontSize: 13, color: '#555' }}>Select a file from the folder tree</span>
        </div>
      );
    }
    return <FileContentPanel file={selectedFile} mode="view"/>;
  };

  return (
    <section
      className="workspace-page"
      style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#0f1018', borderBottom: '1px solid #1e2030', flexShrink: 0 }}>
        {/* Branding / folder name */}
        <span style={{ color: '#7367f0', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          🎨 Canvas
          {folderName && <span style={{ color: '#555', fontWeight: 400 }}>›</span>}
          {folderName && <span style={{ color: '#a3a8b7', fontWeight: 500 }}>{folderName}</span>}
          {selectedFile && !folderName && <span style={{ color: '#555', fontWeight: 400 }}>›</span>}
          {selectedFile && !folderName && <span style={{ color: '#a3a8b7', fontWeight: 500 }}>{selectedFile.name}</span>}
        </span>

        <div style={{ flex: 1 }}/>

        {/* Open buttons */}
        <button onClick={handleOpenFolder} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', background: '#15161d', border: '1px solid #2a2c37', borderRadius: 6, color: '#a3a8b7', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          📁 Open Folder
        </button>
        <button onClick={handleOpenFile} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', background: '#15161d', border: '1px solid #2a2c37', borderRadius: 6, color: '#a3a8b7', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          📄 Open File
        </button>

        {/* View / Edit toggle */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2c37', flexShrink: 0 }}>
          <button onClick={() => setTab('view')} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: tab === 'view' ? '#7367f0' : '#15161d', color: tab === 'view' ? '#fff' : '#a3a8b7', transition: 'all 0.2s'
          }}>
            <Eye size={12}/> View
          </button>
          <button onClick={() => setTab('edit')} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: tab === 'edit' ? '#7367f0' : '#15161d', color: tab === 'edit' ? '#fff' : '#a3a8b7', transition: 'all 0.2s'
          }}>
            <Pencil size={12}/> Edit
          </button>
        </div>

        {/* Sub-modes for Edit */}
        {tab === 'edit' && (
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2c37', flexShrink: 0, marginLeft: 4 }}>
            <button onClick={() => setEditMode('text')} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: editMode === 'text' ? '#1e88e5' : '#15161d', color: editMode === 'text' ? '#fff' : '#a3a8b7', transition: 'all 0.2s'
            }}>
              ✏️ Text Editor
            </button>
            <button onClick={() => setEditMode('paint')} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: editMode === 'paint' ? '#ff4081' : '#15161d', color: editMode === 'paint' ? '#fff' : '#a3a8b7', transition: 'all 0.2s'
            }}>
              🎨 Paint Mode
            </button>
            <button onClick={() => setEditMode('studio')} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: editMode === 'studio' ? '#8e24aa' : '#15161d', color: editMode === 'studio' ? '#fff' : '#a3a8b7', transition: 'all 0.2s'
            }}>
              🎬 Studio Mode
            </button>
          </div>
        )}

        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a3a8b7', cursor: 'pointer', padding: 4, marginLeft: 8 }}><X size={18}/></button>
      </div>

      {/* ── Body: Sidebar + Content ─────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: Folder tree sidebar (always shown when folder or file is loaded) */}
        {(folderPath || selectedFile) && (
          <div style={{
            width: 240, flexShrink: 0, borderRight: '1px solid #1e2030',
            background: '#0b0c13', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Sidebar header */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e2030', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }}>
                {folderName || 'Files'}
              </span>
              {folderPath && (
                <button onClick={() => { setFolderPath(''); setFolderName(''); setSelectedFile(null); setTree([]); }}
                  title="Close folder" style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0, fontSize: 14 }}>✕</button>
              )}
            </div>
            {/* Tree */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {folderPath
                ? (tree.length ? renderTree(tree) : <div style={{ padding: '12px', color: '#555', fontSize: 12 }}>Loading…</div>)
                : selectedFile
                  ? (
                    <div onClick={() => {}} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', color: '#c9d1e0', fontSize: 12.5, background: 'rgba(115,103,240,0.15)', borderLeft: '2px solid #7367f0' }}>
                      <span>{getFileIcon(selectedFile.name)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                    </div>
                  )
                  : null
              }
            </div>
          </div>
        )}

        {/* Right: Main content (view or edit) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#090a0f' }}>
          {/* File path breadcrumb */}
          {selectedFile && (
            <div style={{ padding: '4px 14px', background: '#0d0e14', borderBottom: '1px solid #1a1b26', fontSize: 11, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>
              {selectedFile.path}
            </div>
          )}

          {/* Content area */}
          <div 
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setIsDragOver(false);
              const file = Array.from(e.dataTransfer.files)[0] as any;
              if (file?.path) {
                const name = file.path.split(/[\\/]/).pop() || 'File';
                setSelectedFile({ name, path: file.path, isDirectory: false });
                setEditMode(getEditMode(name));
              }
            }}
          >
            {tab === 'view' ? renderView() : renderEdit()}
          </div>
        </div>
      </div>
    </section>
  );
};

export const NexusMultimediaPage: React.FC = () => {
  const { nexusView, setNexusView, setActiveView } = useAgentStore();

  // ── Landing: 3 buttons ───────────────────────────────────────────────────
  if (!nexusView) {
    return (
      <section className="workspace-page" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', maxWidth: 560, padding: 48 }}>
          <MonitorPlay size={56} style={{ margin: '0 auto 20px', display: 'block', opacity: 0.3, color: '#a3a8b7' }}/>
          <h2 style={{ margin: '0 0 8px', color: '#e9edf5', fontSize: 24, fontWeight: 700 }}>Nexus Studio</h2>
          <p style={{ marginBottom: 36, fontSize: 14, color: '#a3a8b7', lineHeight: 1.6 }}>
            Your creative workspace — view, create, and edit files, code, images, and more.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Canvas / Editor */}
            <button
              onClick={() => setNexusView({ type: 'canvas', path: '', name: 'Canvas' })}
              style={{ background: 'linear-gradient(135deg, #7367f0 0%, #ce9ffc 100%)', border: 'none', padding: '16px 30px', color: '#fff', borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 24px rgba(115,103,240,0.45)', flexDirection: 'column', minWidth: 140 }}>
              <span style={{ fontSize: 32 }}>🎨</span>
              <span>Canvas</span>
              <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 400 }}>View & Edit Files</span>
            </button>
            {/* Create with AI */}
            <button
              onClick={() => setActiveView('chat')}
              style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: '1px solid #7367f0', padding: '16px 30px', color: '#ce9ffc', borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', flexDirection: 'column', minWidth: 140 }}>
              <span style={{ fontSize: 32 }}>✨</span>
              <span>Create with AI</span>
              <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>Generate with chat</span>
            </button>
            {/* Open File Explorer */}
            <button
              onClick={() => setActiveView('files')}
              style={{ background: '#15161d', border: '1px solid #2a2c37', padding: '16px 30px', color: '#e9edf5', borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', flexDirection: 'column', minWidth: 140 }}>
              <span style={{ fontSize: 32 }}>🗂️</span>
              <span>File Explorer</span>
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>Browse local files</span>
            </button>
          </div>
        </div>
      </section>
    );
  }
  // ── Canvas/Editor opened from landing ────────────────────────────────────
  if (nexusView.type === 'canvas') {
    return <CanvasEditorPage onClose={() => setNexusView(null)} />;
  }

  // ── Folder opened from File Explorer ─────────────────────────────────────
  if (nexusView.type === 'folder') {
    return (
      <CanvasEditorPage
        onClose={() => setNexusView(null)}
        initialFolderPath={nexusView.path}
        initialFolderName={nexusView.name}
      />
    );
  }

  // ── Any single file opened from File Explorer ────────────────────────────
  return (
    <CanvasEditorPage
      onClose={() => setNexusView(null)}
      initialFilePath={nexusView.path}
      initialFileName={nexusView.name}
    />
  );
};

export const ChatHistoryPage: React.FC = () => {
  const { chats, loadChat, deleteChat } = useAgentStore();
  
  return (
    <section className="workspace-page">
      <header>
        <div>
          <p className="eyebrow">SAVED CONVERSATIONS</p>
          <h1>Chat History</h1>
          <span>View and continue your past conversations with Nexus AI.</span>
        </div>
      </header>
      <div className="log-list" style={{ padding: '0 28px' }}>
        {chats.length ? chats.map(chat => (
          <article key={chat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => loadChat(chat.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span><MessageCircle /></span>
              <div>
                <strong>{chat.name}</strong>
                <small>{new Date(chat.date).toLocaleString()} · {chat.messages.length} messages</small>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' }}>
              <XCircle size={18} />
            </button>
          </article>
        )) : (
          <p className="page-empty">No saved chats yet. Click "Save Chat" in the Chat view to store conversations here.</p>
        )}
      </div>
    </section>
  );
};

export const MapsPage = () => <IntegrationPage kind="maps"/>;
export const WeatherDashboardPage = () => <WeatherPage />;
export const VoiceAssistantPage = () => <section className="workspace-page"><VoiceAssistantUI /></section>;
