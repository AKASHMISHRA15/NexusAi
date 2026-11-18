import React, { useEffect, useRef, useState } from 'react';
import {
  Brush, Eraser, Minus, Square, Circle, Type, Save,
  Undo2, Redo2, RotateCcw, RotateCw, FlipHorizontal, FlipVertical,
  Sun, Contrast, Droplets, Sparkles, Image as ImageIcon, Edit3
} from 'lucide-react';
import { toast } from 'sonner';
import { convertFileSrc } from '@tauri-apps/api/core';
import { save as dialogSave } from '@tauri-apps/plugin-dialog';

interface Filter { brightness: number; contrast: number; saturation: number; blur: number; grayscale: number; sepia: number; }
const defaultFilter: Filter = { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0 };
const PRESETS: { name: string; filter: Filter }[] = [
  { name: 'Original', filter: defaultFilter },
  { name: 'B&W', filter: { ...defaultFilter, grayscale: 100, saturation: 0 } },
  { name: 'Vivid', filter: { ...defaultFilter, saturation: 160, contrast: 115, brightness: 105 } },
  { name: 'Fade', filter: { ...defaultFilter, brightness: 112, contrast: 80, saturation: 75 } }
];

type Tool = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'text' | 'fill';
interface HistoryEntry { imageData: ImageData }
const PALETTE = ['#ffffff','#000000','#ff4081','#e53935','#fb8c00','#fdd835','#43a047','#00acc1','#1e88e5','#8e24aa'];

export const UnifiedImageEditor: React.FC<{ path: string; name: string, forceTab?: 'paint' | 'studio' }> = ({ path, name, forceTab }) => {
  const [activeTab, setActiveTab] = useState<'paint' | 'studio'>(forceTab || 'paint');

  useEffect(() => {
    if (forceTab) setActiveTab(forceTab);
  }, [forceTab]);
  
  // Paint State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#ff4081');
  const [size, setSize] = useState(6);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [text, setText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });

  // Studio State
  const [filter, setFilter] = useState<Filter>(defaultFilter);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState({ h: false, v: false });
  const [zoom, setZoom] = useState(1);

  const src = path ? convertFileSrc(path) : '';
  const isVideo = name ? ['mp4','webm','mov'].includes(name.split('.').pop()?.toLowerCase() || '') : false;

  // Init canvas for Paint
  useEffect(() => {
    if (activeTab !== 'paint' || isVideo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!src) {
      // blank canvas
      canvas.width = 800; canvas.height = 600;
      if (overlayRef.current) { overlayRef.current.width = 800; overlayRef.current.height = 600; }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 800, 600);
      setHistory([{ imageData: ctx.getImageData(0, 0, 800, 600) }]);
      setRedoStack([]);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      if (overlayRef.current) {
        overlayRef.current.width = img.naturalWidth;
        overlayRef.current.height = img.naturalHeight;
      }
      ctx.drawImage(img, 0, 0);
      setHistory([{ imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) }]);
      setRedoStack([]);
    };
    img.src = src;
  }, [src, activeTab, isVideo]);

  // Paint Handlers
  const pushHistory = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(h => [...h.slice(-30), { imageData }]);
    setRedoStack([]);
  };

  const undo = () => {
    if (history.length < 2) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const prev = history[history.length - 2];
    setRedoStack(r => [{ imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) }, ...r]);
    setHistory(h => h.slice(0, -1));
    ctx.putImageData(prev.imageData, 0, 0);
  };

  const redo = () => {
    if (!redoStack.length) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const next = redoStack[0];
    pushHistory(ctx);
    setRedoStack(r => r.slice(1));
    ctx.putImageData(next.imageData, 0, 0);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'paint') return;
    const pos = getPos(e);
    setStartPos(pos);
    setDrawing(true);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    if (tool === 'text') {
      setTextPos(pos); setShowTextInput(true); setDrawing(false); return;
    }
    if (tool === 'brush' || tool === 'eraser') {
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || activeTab !== 'paint') return;
    const pos = getPos(e);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const ov = overlayRef.current!;
    const ovCtx = ov.getContext('2d')!;

    if (tool === 'brush') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = size * 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ovCtx.clearRect(0, 0, ov.width, ov.height);
      ovCtx.strokeStyle = color; ovCtx.lineWidth = size;
      ovCtx.beginPath();
      if (tool === 'line') { ovCtx.moveTo(startPos.x, startPos.y); ovCtx.lineTo(pos.x, pos.y); }
      else if (tool === 'rect') { ovCtx.rect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y); }
      else if (tool === 'ellipse') {
        const rx = Math.abs(pos.x - startPos.x)/2, ry = Math.abs(pos.y - startPos.y)/2;
        ovCtx.ellipse(startPos.x+(pos.x-startPos.x)/2, startPos.y+(pos.y-startPos.y)/2, rx, ry, 0, 0, Math.PI*2);
      }
      ovCtx.stroke();
    }
  };

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || activeTab !== 'paint') return;
    const pos = getPos(e);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const ov = overlayRef.current!;
    ov.getContext('2d')!.clearRect(0, 0, ov.width, ov.height);

    if (['line','rect','ellipse'].includes(tool)) {
      ctx.strokeStyle = color; ctx.lineWidth = size;
      ctx.beginPath();
      if (tool === 'line') { ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(pos.x, pos.y); }
      else if (tool === 'rect') { ctx.rect(startPos.x, startPos.y, pos.x-startPos.x, pos.y-startPos.y); }
      else if (tool === 'ellipse') {
        const rx = Math.abs(pos.x-startPos.x)/2, ry = Math.abs(pos.y-startPos.y)/2;
        ctx.ellipse(startPos.x+(pos.x-startPos.x)/2, startPos.y+(pos.y-startPos.y)/2, rx, ry, 0, 0, Math.PI*2);
      }
      ctx.stroke();
    }
    setDrawing(false);
    pushHistory(ctx);
  };

  const placeText = () => {
    if (!text) { setShowTextInput(false); return; }
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color; ctx.font = `${size * 3}px Inter, sans-serif`;
    ctx.fillText(text, textPos.x, textPos.y);
    pushHistory(ctx);
    setText(''); setShowTextInput(false);
  };

  const saveFile = async () => {
    try {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      
      let targetPath = path;
      if (!targetPath) {
        const selected = await dialogSave({ filters: [{ name: 'Image', extensions: ['png'] }] });
        if (!selected) return;
        targetPath = selected;
      }

      if (activeTab === 'paint' && canvasRef.current) {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await writeFile(targetPath, bytes);
        toast.success(`Saved to ${targetPath.split(/[\\/]/).pop()}`);
      } else if (activeTab === 'studio') {
        const img = document.getElementById('studio-preview') as HTMLImageElement;
        if (!img || !img.src) { toast.error("No image to save in Studio mode."); return; }
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.filter = `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturation}%) blur(${filter.blur}px) grayscale(${filter.grayscale}%) sepia(${filter.sepia}%)`;
        ctx.save();
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.rotate((rotation * Math.PI)/180);
        ctx.scale(flip.h ? -1 : 1, flip.v ? -1 : 1);
        ctx.drawImage(img, -canvas.width/2, -canvas.height/2);
        ctx.restore();
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await writeFile(targetPath, bytes);
        toast.success(`Saved to ${targetPath.split(/[\\/]/).pop()}`);
      }
    } catch (e) { toast.error('Save failed: ' + e); }
  };

  const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'brush', icon: <Brush size={14}/>, label: 'Brush' },
    { id: 'eraser', icon: <Eraser size={14}/>, label: 'Eraser' },
    { id: 'line', icon: <Minus size={14}/>, label: 'Line' },
    { id: 'rect', icon: <Square size={14}/>, label: 'Rect' },
    { id: 'ellipse', icon: <Circle size={14}/>, label: 'Circle' },
    { id: 'text', icon: <Type size={14}/>, label: 'Text' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0e14' }}>
      {/* Universal Top Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#111', borderBottom: '1px solid #242631' }}>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #2a2c37', marginRight: 10 }}>
          <button onClick={() => setActiveTab('paint')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: 'none', background: activeTab === 'paint' ? '#7367f0' : '#15161d', color: activeTab === 'paint' ? '#fff' : '#a3a8b7', cursor: 'pointer', fontSize: 12, fontWeight: 600 }} disabled={isVideo}>
            <Edit3 size={13}/> Paint Mode
          </button>
          <button onClick={() => setActiveTab('studio')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: 'none', background: activeTab === 'studio' ? '#7367f0' : '#15161d', color: activeTab === 'studio' ? '#fff' : '#a3a8b7', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <ImageIcon size={13}/> Studio Mode
          </button>
        </div>
        
        {activeTab === 'paint' ? (
          <>
            {TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
                style={{ padding: '4px 8px', borderRadius: 6, border: tool === t.id ? '1px solid #7367f0' : '1px solid transparent', background: tool === t.id ? '#221e4a' : 'transparent', color: tool === t.id ? '#9b8efd' : '#a3a8b7', cursor: 'pointer' }}>
                {t.icon}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: '#2a2c37' }}/>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ border: 'none', background: 'none', cursor: 'pointer', width: 24, height: 24, padding: 0 }}/>
            {PALETTE.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 14, height: 14, borderRadius: 3, background: c, border: color === c ? '2px solid #7367f0' : '1px solid #2a2c37', cursor: 'pointer' }}/>)}
            <input type="range" min={1} max={40} value={size} onChange={e => setSize(+e.target.value)} style={{ width: 60, marginLeft: 8 }}/>
            <button onClick={undo} style={{ padding: '4px', background: 'none', border: 'none', color: '#a3a8b7', cursor: 'pointer', marginLeft: 'auto' }}><Undo2 size={16}/></button>
            <button onClick={redo} style={{ padding: '4px', background: 'none', border: 'none', color: '#a3a8b7', cursor: 'pointer' }}><Redo2 size={16}/></button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
            <button onClick={() => setRotation(r => r - 90)} style={{ padding: '5px', background: '#15161d', border: '1px solid #2a2c37', borderRadius: 4, color: '#a3a8b7', cursor: 'pointer' }}><RotateCcw size={14}/></button>
            <button onClick={() => setRotation(r => r + 90)} style={{ padding: '5px', background: '#15161d', border: '1px solid #2a2c37', borderRadius: 4, color: '#a3a8b7', cursor: 'pointer' }}><RotateCw size={14}/></button>
            <button onClick={() => setFlip(f => ({ ...f, h: !f.h }))} style={{ padding: '5px', background: flip.h ? '#221e4a' : '#15161d', border: `1px solid ${flip.h ? '#7367f0' : '#2a2c37'}`, borderRadius: 4, color: flip.h ? '#9b8efd' : '#a3a8b7', cursor: 'pointer' }}><FlipHorizontal size={14}/></button>
            <button onClick={() => setFlip(f => ({ ...f, v: !f.v }))} style={{ padding: '5px', background: flip.v ? '#221e4a' : '#15161d', border: `1px solid ${flip.v ? '#7367f0' : '#2a2c37'}`, borderRadius: 4, color: flip.v ? '#9b8efd' : '#a3a8b7', cursor: 'pointer' }}><FlipVertical size={14}/></button>
          </div>
        )}
        <button onClick={saveFile} disabled={isVideo && activeTab === 'studio'} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#7367f0', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, marginLeft: activeTab === 'paint' ? 8 : 16 }}>
          <Save size={14}/> Save
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Workspace */}
        <div style={{ flex: 1, overflow: 'auto', background: '#090a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative' }}>
          {activeTab === 'paint' && !isVideo ? (
            <div style={{ position: 'relative', cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : 'crosshair', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <canvas ref={canvasRef} style={{ maxWidth: '100%', display: 'block' }}/>
              <canvas ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, maxWidth: '100%', pointerEvents: 'none' }}/>
              <canvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => setDrawing(false)}/>
              {showTextInput && (
                <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#1a1b27', border: '1px solid #2a2c37', borderRadius: 12, padding: 20, zIndex: 999 }}>
                  <input autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && placeText()} style={{ padding: '8px 12px', background: '#0d0e14', border: '1px solid #2a2c37', borderRadius: 8, color: '#e9edf5', outline: 'none' }}/>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setShowTextInput(false)} style={{ flex: 1, padding: '6px', background: '#15161d', border: '1px solid #2a2c37', borderRadius: 6, color: '#a3a8b7', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={placeText} style={{ flex: 1, padding: '6px', background: '#7367f0', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>Place</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            isVideo ? (
              <video id="studio-preview" src={src} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', filter: `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturation}%) blur(${filter.blur}px) grayscale(${filter.grayscale}%) sepia(${filter.sepia}%)`, transform: `rotate(${rotation}deg) scale(${flip.h ? -1 : 1}, ${flip.v ? -1 : 1}) scale(${zoom})` }}/>
            ) : src ? (
              <img id="studio-preview" src={src} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: `brightness(${filter.brightness}%) contrast(${filter.contrast}%) saturate(${filter.saturation}%) blur(${filter.blur}px) grayscale(${filter.grayscale}%) sepia(${filter.sepia}%)`, transform: `rotate(${rotation}deg) scale(${flip.h ? -1 : 1}, ${flip.v ? -1 : 1}) scale(${zoom})`, transition: 'all 0.15s' }}/>
            ) : (
              <div style={{ color: '#a3a8b7' }}>Open an image from the Explorer to use Studio Mode.</div>
            )
          )}
        </div>

        {/* Studio Sidebar */}
        {activeTab === 'studio' && (
          <div style={{ width: 280, borderLeft: '1px solid #242631', background: '#0d0e14', overflowY: 'auto', padding: 16, flexShrink: 0 }}>
            <p style={{ color: '#6d7483', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Presets</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 20 }}>
              {PRESETS.map(p => (
                <button key={p.name} onClick={() => setFilter(p.filter)} style={{ padding: '6px', borderRadius: 6, border: '1px solid #2a2c37', background: '#15161d', color: '#a3a8b7', cursor: 'pointer', fontSize: 12 }}>{p.name}</button>
              ))}
            </div>
            
            <p style={{ color: '#6d7483', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Zoom</p>
            <input type="range" min={0.25} max={3} step={0.05} value={zoom} onChange={e => setZoom(+e.target.value)} style={{ width: '100%', marginBottom: 20, accentColor: '#7367f0' }}/>
            
            <p style={{ color: '#6d7483', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Adjustments</p>
            {[
              { label: 'Brightness', f: 'brightness', max: 200, icon: <Sun size={12}/> },
              { label: 'Contrast', f: 'contrast', max: 200, icon: <Contrast size={12}/> },
              { label: 'Saturation', f: 'saturation', max: 300, icon: <Droplets size={12}/> },
              { label: 'Blur', f: 'blur', max: 20, step: 0.5, icon: <Sparkles size={12}/> },
              { label: 'Grayscale', f: 'grayscale', max: 100, icon: <span style={{fontSize:10}}>GR</span> },
              { label: 'Sepia', f: 'sepia', max: 100, icon: <span style={{fontSize:10}}>SP</span> }
            ].map(({ label, f, max, step = 1, icon }) => (
              <div key={f} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#a3a8b7', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {label}</span>
                  <span style={{ color: '#7367f0' }}>{filter[f as keyof Filter]}{f !== 'blur' ? '%' : 'px'}</span>
                </div>
                <input type="range" min={0} max={max} step={step} value={filter[f as keyof Filter]} onChange={e => setFilter(prev => ({ ...prev, [f]: +e.target.value }))} style={{ width: '100%', accentColor: '#7367f0' }}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
