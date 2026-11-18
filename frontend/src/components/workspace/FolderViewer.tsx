import React, { useEffect, useState } from 'react';
import { readDir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  X, Folder, File, ChevronRight, ChevronDown,
  Eye, Pencil, Save
} from 'lucide-react';
import { UnifiedImageEditor } from './UnifiedImageEditor';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────
interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  isOpen?: boolean;
}

type ViewMode = 'view' | 'edit';
// Removed DrawTool

// ─── Code / Text Editor ─────────────────────────────────────────────────────
const CodeEditor: React.FC<{ path: string; name: string }> = ({ path, name }) => {
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    readTextFile(path)
      .then(t => { setContent(t); setLoading(false); })
      .catch(e => { setContent('Error: ' + e); setLoading(false); });
  }, [path]);

  const handleSave = async () => {
    try {
      await writeTextFile(path, content);
      setSaved(true);
      toast.success(`Saved ${name}`);
    } catch (e) {
      toast.error('Save failed: ' + e);
    }
  };

  if (loading) return <div style={{ color: '#aaa', padding: 24 }}>Loading…</div>;

  const ext = name.split('.').pop()?.toLowerCase() || '';
  const langColors: Record<string, string> = {
    py: '#3572a5', js: '#f1e05a', ts: '#3178c6', tsx: '#3178c6', jsx: '#61dafb',
    html: '#e34c26', css: '#563d7c', rs: '#dea584', go: '#00add8', java: '#b07219',
    cpp: '#f34b7d', c: '#555555', json: '#292929', md: '#083fa1'
  };
  const langColor = langColors[ext] || '#7367f0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0e14' }}>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#111', borderBottom: '1px solid #242631' }}>
        <span style={{ padding: '2px 8px', borderRadius: 4, background: langColor, color: '#fff', fontSize: 11, fontWeight: 700 }}>{ext.toUpperCase()}</span>
        <span style={{ flex: 1, color: '#a3a8b7', fontSize: 13 }}>{name}</span>
        {!saved && <span style={{ color: '#f0a500', fontSize: 11 }}>● Unsaved</span>}
        <button
          onClick={handleSave}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#7367f0', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          <Save size={14}/> Save
        </button>
      </div>
      {/* editor */}
      <textarea
        value={content}
        onChange={e => { setContent(e.target.value); setSaved(false); }}
        spellCheck={false}
        style={{
          flex: 1, margin: 0, padding: 20, border: 'none', outline: 'none', resize: 'none',
          background: '#090a0f', color: '#e9edf5', fontFamily: 'Consolas, Monaco, monospace',
          fontSize: 13.5, lineHeight: 1.7, tabSize: 2
        }}
      />
    </div>
  );
};

// ─── Paint / Image Editor (Removed, using UnifiedImageEditor) ─────────────

// ─── Plain Text Viewer ───────────────────────────────────────────────────────
const TextViewer: React.FC<{ path: string }> = ({ path }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    readTextFile(path)
      .then(t => { setContent(t); setLoading(false); })
      .catch(e => { setContent('Error: ' + e); setLoading(false); });
  }, [path]);

  if (loading) return <div style={{ color: '#aaa', padding: 24 }}>Loading…</div>;

  return (
    <pre style={{ margin: 0, padding: 20, width: '100%', height: '100%', overflow: 'auto', color: '#e9edf5', background: '#090a0f', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
      {content}
    </pre>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const isText = (ext: string) => ['txt','json','md','ts','tsx','js','jsx','csv','py','html','css','cpp','c','java','rs','go','sh','yaml','yml','toml','ini','xml','sql'].includes(ext);
const isImage = (ext: string) => ['png','jpg','jpeg','gif','webp','bmp'].includes(ext);
const isVideo = (ext: string) => ['mp4','webm','ogg','mov'].includes(ext);
const isAudio = (ext: string) => ['mp3','wav','ogg','flac'].includes(ext);

// ─── File Content Panel (View + Edit) ───────────────────────────────────────
export const FileContentPanel: React.FC<{ file: TreeNode | null; mode: ViewMode, editMode?: 'text' | 'paint' | 'studio' }> = ({ file, mode, editMode }) => {
  if (!file) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: '#555', flexDirection: 'column', gap: 12 }}>
        <Eye size={32} style={{ opacity: 0.3 }}/>
        <span style={{ fontSize: 14 }}>Select a file to {mode === 'view' ? 'view' : 'edit'}</span>
      </div>
    );
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const src = convertFileSrc(file.path);

  if (mode === 'edit') {
    if (editMode === 'text') return <CodeEditor path={file.path} name={file.name}/>;
    if (editMode === 'paint' || editMode === 'studio') return <UnifiedImageEditor path={file.path} name={file.name} forceTab={editMode}/>;
    return <div style={{ padding: 24, color: '#a3a8b7' }}>Edit mode is not available for this file type. Switch to View mode.</div>;
  }

  // View mode
  if (isImage(ext)) return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20, overflow: 'hidden' }}><img src={src} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}/></div>;
  if (isVideo(ext)) return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}><video src={src} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%' }}/></div>;
  if (isAudio(ext)) return <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><audio src={src} controls autoPlay/></div>;
  if (ext === 'pdf') return <iframe src={src} style={{ flex: 1, border: 'none', background: '#fff' }}/>;
  if (isText(ext)) return <div style={{ flex: 1, overflow: 'hidden' }}><TextViewer path={file.path}/></div>;

  return <div style={{ padding: 24, color: '#a3a8b7' }}>Preview not available for .{ext} files.</div>;
};

// ─── FolderViewer (Main Export) ──────────────────────────────────────────────
export const FolderViewer: React.FC<{ rootPath: string; rootName: string; onClose: () => void; inline?: boolean }> = ({ rootPath, rootName, onClose, inline = false }) => {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [mode, setMode] = useState<ViewMode>('view');

  useEffect(() => {
    const load = async () => {
      try {
        const entries = await readDir(rootPath);
        const nodes: TreeNode[] = await Promise.all(entries.map(async e => ({ name: e.name, path: await join(rootPath, e.name), isDirectory: e.isDirectory })));
        nodes.sort((a, b) => a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1);
        setTree(nodes);
      } catch (err) { console.error(err); }
    };
    load();
  }, [rootPath]);

  const toggleFolder = async (node: TreeNode) => {
    if (!node.isOpen && !node.children) {
      try {
        const entries = await readDir(node.path);
        const children: TreeNode[] = await Promise.all(entries.map(async e => ({ name: e.name, path: await join(node.path, e.name), isDirectory: e.isDirectory })));
        children.sort((a, b) => a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1);
        node.children = children;
      } catch {}
    }
    node.isOpen = !node.isOpen;
    setTree([...tree]);
  };

  const renderTree = (nodes: TreeNode[], depth = 0): React.ReactNode => nodes.map(node => (
    <div key={node.path}>
      <div
        onClick={() => node.isDirectory ? toggleFolder(node) : setSelected(node)}
        style={{ display: 'flex', alignItems: 'center', padding: `5px 10px 5px ${8 + depth * 14}px`, cursor: 'pointer', borderRadius: 4, margin: '1px 4px', background: selected?.path === node.path ? 'rgba(115,103,240,0.15)' : 'transparent', color: node.isDirectory ? '#8b82fd' : '#a3a8b7', fontSize: 13, userSelect: 'none' }}
      >
        {node.isDirectory ? (node.isOpen ? <ChevronDown size={13} style={{ marginRight: 4, flexShrink: 0 }}/> : <ChevronRight size={13} style={{ marginRight: 4, flexShrink: 0 }}/>) : <File size={13} style={{ marginRight: 6, opacity: 0.6, flexShrink: 0 }}/>}
        {node.isDirectory && <Folder size={13} style={{ marginRight: 6, flexShrink: 0 }}/>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
      {node.isDirectory && node.isOpen && node.children && renderTree(node.children, depth + 1)}
    </div>
  ));

  const containerStyle: React.CSSProperties = inline
    ? { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#0b0c11' }
    : { position: 'fixed', inset: 0, background: '#0b0c11', zIndex: 9999, display: 'flex', flexDirection: 'column' };

  return (
    <div style={containerStyle}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#111', borderBottom: '1px solid #242631', flexShrink: 0 }}>
        <Folder size={15} color="#8b82fd" style={{ flexShrink: 0 }}/>
        <h3 style={{ margin: 0, color: '#fff', fontSize: 14, flex: 1 }}>{rootName}</h3>
        {/* View / Edit Toggle */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2c37' }}>
          {(['view', 'edit'] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: mode === m ? '#7367f0' : '#15161d', color: mode === m ? '#fff' : '#a3a8b7', transition: 'all 0.2s' }}>
              {m === 'view' ? <Eye size={13}/> : <Pencil size={13}/>}
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a3a8b7', cursor: 'pointer', flexShrink: 0 }}><X size={20}/></button>
      </div>
      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* File Tree */}
        <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid #242631', background: '#0d0e14', overflowY: 'auto', padding: '8px 0' }}>
          {renderTree(tree)}
        </div>
        {/* Content Panel */}
        <div style={{ flex: 1, minWidth: 0, background: '#090a0f', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selected && (
            <div style={{ padding: '6px 14px', background: '#111', borderBottom: '1px solid #1e2030', fontSize: 12, color: '#a3a8b7', fontFamily: 'monospace' }}>
              {selected.path}
            </div>
          )}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <FileContentPanel file={selected} mode={mode}/>
          </div>
        </div>
      </div>
    </div>
  );
};
