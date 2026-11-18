import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Paperclip, X, FileText, Camera, RefreshCw } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { toast } from 'sonner';

interface UploadedAttachment {
  filename: string;
  path: string;
  isImage: boolean;
  previewUrl?: string;
}

const MAX_IMAGES = 5;
const MAX_DOCUMENTS = 10;

const isImageFile = (file: File) => file.type.startsWith('image/');

export const InputBar: React.FC = () => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [previewing, setPreviewing] = useState<UploadedAttachment | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const { sendMessage, sessionTtsEnabled, setSessionTtsEnabled } = useAgentStore();
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsRecording(false);
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        if (event.error !== 'no-speech') {
          toast.error("Microphone access denied or failed.");
        }
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  useEffect(() => {
    window.addEventListener('nexus:start-voice', toggleRecording);
    return () => window.removeEventListener('nexus:start-voice', toggleRecording);
  });

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      toast.info("Listening...");
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const uploadFiles = async (selected: File[]) => {
    const currentImages = attachments.filter(file => file.isImage).length;
    const currentDocuments = attachments.length - currentImages;
    let availableImages = MAX_IMAGES - currentImages;
    let availableDocuments = MAX_DOCUMENTS - currentDocuments;
    const files = selected.filter(file => {
      if (isImageFile(file)) {
        if (availableImages <= 0) return false;
        availableImages -= 1;
        return true;
      }
      if (availableDocuments <= 0) return false;
      availableDocuments -= 1;
      return true;
    });
    if (files.length < selected.length) {
      toast.info(`You can attach up to ${MAX_IMAGES} images and ${MAX_DOCUMENTS} documents at once.`);
    }
    if (!files.length) {
      return;
    }

    setIsUploading(true);
    try {
      const uploaded: UploadedAttachment[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('http://127.0.0.1:8765/api/uploads', {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }
        const data = await res.json();
        uploaded.push({
          filename: data.filename,
          path: data.path,
          isImage: isImageFile(file),
          previewUrl: isImageFile(file) ? URL.createObjectURL(file) : undefined,
        });
      }

      setAttachments(prev => [
        ...prev,
        ...uploaded
      ]);
      toast.success(uploaded.length === 1 ? 'Attachment added' : `${uploaded.length} attachments added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    await uploadFiles(selected);
    event.target.value = '';
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files || []);
    if (!files.length) return;
    event.preventDefault();
    void uploadFiles(files);
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setIsCameraOpen(false);
  };

  const startCamera = async (facing: 'user' | 'environment') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera access is not supported in this browser.');
      return;
    }
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    try {
      setCameraFacing(facing);
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      setIsCameraOpen(false);
      toast.error('Could not access the camera. Check the browser camera permission.');
      console.error('Camera access failed', error);
    }
  };

  const captureCameraPhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error('The camera is still starting. Please try again in a moment.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        toast.error('Could not capture the photo.');
        return;
      }
      const photo = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      closeCamera();
      void uploadFiles([photo]);
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types || []).includes('Files');
    const canAcceptMore = () => {
      const imageCount = attachments.filter(file => file.isImage).length;
      const documentCount = attachments.length - imageCount;
      return imageCount < MAX_IMAGES || documentCount < MAX_DOCUMENTS;
    };

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    };
    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault(); // Prevent the browser from opening the dropped file.
      if (event.dataTransfer) event.dataTransfer.dropEffect = canAcceptMore() && !isUploading ? 'copy' : 'none';
    };
    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (!dragDepthRef.current) setIsDraggingFiles(false);
    };
    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
      if (isUploading) {
        toast.info('Please wait for the current files to finish uploading.');
        return;
      }
      if (!canAcceptMore()) {
        toast.info(`Attachment limit reached (${MAX_IMAGES} images and ${MAX_DOCUMENTS} documents). Remove an attachment to add another.`);
        return;
      }
      void uploadFiles(Array.from(event.dataTransfer?.files || []));
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [attachments, isUploading]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && attachments.length === 0) return;

    const attachmentContext = attachments.length
      ? `\n\nAttached file(s):\n${attachments.map(file => `- ${file.filename}: ${file.path}`).join('\n')}`
      : '';

    sendMessage(`${input.trim()}${attachmentContext}`.trim());
    setInput('');
    attachments.forEach(file => file.previewUrl && URL.revokeObjectURL(file.previewUrl));
    setAttachments([]);
  };

  const removeAttachment = (file: UploadedAttachment) => {
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
    setAttachments(prev => prev.filter(item => item.path !== file.path));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div 
      className={`input-area px-4 pb-4 pt-2 ${isDraggingFiles ? 'bg-accent-primary/10 border-accent-primary/50 border-dashed border-2 rounded-xl' : ''}`}
    >
      {isDraggingFiles && (
        <div className="file-drop-overlay" aria-live="polite">
          <div>
            <Paperclip size={28} />
            <strong>{isUploading ? 'Uploading attachments…' : 'Drop files to attach'}</strong>
            <span>Up to {MAX_IMAGES} images and {MAX_DOCUMENTS} documents per message</span>
          </div>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="attachment-tray">
          {attachments.map(file => (
            <div className="attachment-chip" key={file.path}>
              <button
                type="button"
                className="attachment-preview-button"
                title={file.isImage ? `Preview ${file.filename}` : file.filename}
                onClick={() => file.isImage && setPreviewing(file)}
              >
                {file.isImage && file.previewUrl ? <img src={file.previewUrl} alt="" /> : <FileText size={20} />}
              </button>
              <span title={file.filename}>{file.filename}</span>
              <button
                type="button"
                title="Remove attachment"
                onClick={() => removeAttachment(file)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="input-container glass rounded-2xl flex items-end gap-2 p-2 focus-within:shadow-glow focus-within:border-accent-primary/50 transition-all mx-auto max-w-4xl w-full">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />
        <button type="button" className="input-action-btn" title="Attach files (up to 5 images and 10 documents)" onClick={handleFileUpload}>
          <Paperclip size={18} />
        </button>
        <button type="button" className="input-action-btn" title="Take a photo to analyze" onClick={() => void startCamera('environment')}>
          <Camera size={18} />
        </button>
        
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Ask NexusAI to do something..."
          className="input-textarea"
          rows={1}
        />
        
        <div className="input-actions">
          <button 
            type="button" 
            className={`input-action-btn ${sessionTtsEnabled ? 'text-accent-primary' : 'text-gray-500'}`}
            onClick={() => setSessionTtsEnabled(!sessionTtsEnabled)}
            title={sessionTtsEnabled ? "Chat TTS On (click to mute this chat)" : "Chat TTS Off (click to enable for this chat)"}
          >
            {sessionTtsEnabled ? <span style={{fontSize:'12px', fontWeight:'bold'}}>🔊</span> : <span style={{fontSize:'12px', opacity:0.5}}>🔇</span>}
          </button>
          
          <button 
            type="button" 
            className={`input-action-btn ${isRecording ? 'text-red-500 animate-pulse' : ''}`}
            onClick={toggleRecording}
            title="Voice input"
          >
            <Mic size={18} />
          </button>
          
          <button 
            type="submit" 
            className="send-btn w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-tr from-accent-primary to-accent-secondary text-white disabled:opacity-50 disabled:grayscale transition-all shadow-glow hover:scale-105"
            disabled={(!input.trim() && attachments.length === 0) || isUploading}
          >
            <Send size={16} className="-ml-0.5 mt-0.5" />
          </button>
        </div>
      </form>
      <div className="input-hint">
        Attach up to {MAX_IMAGES} images or {MAX_DOCUMENTS} documents. Click an image to preview it.
      </div>
      {previewing?.previewUrl && (
        <div className="attachment-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewing(null)}>
          <div className="attachment-lightbox-content" onClick={event => event.stopPropagation()}>
            <button type="button" className="attachment-lightbox-close" onClick={() => setPreviewing(null)} title="Close preview"><X size={20} /></button>
            <img src={previewing.previewUrl} alt={previewing.filename} />
            <div>{previewing.filename}</div>
          </div>
        </div>
      )}
      {isCameraOpen && (
        <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Camera capture">
          <div className="camera-modal-content">
            <div className="camera-modal-header">
              <strong>Capture a photo</strong>
              <button type="button" onClick={closeCamera} title="Close camera"><X size={19} /></button>
            </div>
            <video ref={videoRef} className="camera-preview" autoPlay playsInline muted />
            <div className="camera-modal-actions">
              <button type="button" className={cameraFacing === 'user' ? 'active' : ''} onClick={() => void startCamera('user')}>Front</button>
              <button type="button" className={cameraFacing === 'environment' ? 'active' : ''} onClick={() => void startCamera('environment')}>Back</button>
              <button type="button" className="camera-capture-btn" onClick={captureCameraPhoto}><Camera size={18} /> Capture</button>
              <button type="button" title="Switch camera" onClick={() => void startCamera(cameraFacing === 'user' ? 'environment' : 'user')}><RefreshCw size={17} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
