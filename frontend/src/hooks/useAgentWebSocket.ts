import { useEffect, useRef, useCallback } from 'react';
import { useAgentStore } from '../stores/agentStore';
import { toast } from 'sonner';

export const useAgentWebSocket = () => {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | undefined>(undefined);
  // Records when the WebSocket session started so historical/buffered notifications
  // (received before this moment) are silently dropped.
  const sessionStartTime = useRef<number>(Date.now());
  
  const { 
    setConnected, 
    updateMessage,
    setAgentActive,
    startTask,
    finishTask,
    addActivityEvent,
    addMessage,
    addNotification,
    setNotificationDrawerOpen,
  } = useAgentStore();

  const connect = useCallback(() => {
    // Determine WS URL based on current host if not specified via env
    const wsUrl = `ws://127.0.0.1:8765/ws/agent`;
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      // Reset the session clock so only NEW notifications are processed
      sessionStartTime.current = Date.now();
      setConnected(true);
      console.log('Connected to NexusAI Backend');
      toast.success('Connected to NexusAI core');
    };
    
    ws.current.onclose = () => {
      setConnected(false);
      setAgentActive(false);
      console.log('Disconnected from backend');
      
      // Auto-reconnect after 3s
      reconnectTimeout.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };
    
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            // Server confirmed connection — reset the session clock here too
            sessionStartTime.current = Date.now();
            break;
            
          case 'thinking':
          case 'tool_start':
          case 'tool_end':
            // Add to activity stream (terminal)
            addActivityEvent({
              type: data.type,
              message: data.message,
              tool: data.tool,
              success: data.success,
              taskId: data.task_id,
            });
            break;
            
          case 'stream':
            // Append token to current assistant message
            updateMessage(data.task_id, data.text);
            break;

          case 'notification': {
            // Bug 3 fix — skip historical notifications buffered before this session.
            // If the backend provides a Unix timestamp (seconds), convert to ms for comparison.
            const notifTime: number = data.timestamp ? Number(data.timestamp) * 1000 : Date.now();
            if (notifTime < sessionStartTime.current) {
              console.log('[Notification] Skipping historical notification:', data.title || data.app_name);
              break;
            }

            const state = useAgentStore.getState();

            // Only process when "Allow App to read notifications" is on
            if (!state.appReadNotifications) break;

            const title: string = data.title || data.app_name || 'Notification';
            const body: string = data.body || data.summary || `${data.app_name || 'App'} notification`;
            // Human-readable summary, e.g. "WhatsApp message from Rah: Hello"
            const summary: string = data.summary || `${title}: ${body}`;

            // Bug 1 fix — always add to in-app drawer, regardless of output mode
            const wasAdded = addNotification({ title, body, appName: data.app_name });
            
            // If it was dropped as a duplicate, DO NOT continue to TTS or Toast!
            if (!wasAdded) {
              console.log('[Notification] Dropped duplicate event for:', title);
              break;
            }

            if (state.notificationOutput === 'tts') {
              // Bug 2 fix — check notificationOutput, NOT the separate notificationTtsEnabled field
              const utterance = new SpeechSynthesisUtterance(summary);
              const voices = window.speechSynthesis.getVoices();
              const preferredVoice = voices.find(v => v.name.includes('Microsoft Mark') || v.name.includes('Google UK English Male')) || voices[0];
              if (preferredVoice) utterance.voice = preferredVoice;
              window.speechSynthesis.speak(utterance);
            } else {
              // show_only mode: open in-app drawer AND send a real Windows toast
              setNotificationDrawerOpen(true);

              // Bug 4 fix — send native Windows notification via Tauri plugin
              import('@tauri-apps/plugin-notification')
                .then(({ isPermissionGranted, requestPermission, sendNotification }) => {
                  isPermissionGranted().then(async (granted) => {
                    let permissionGranted = granted;
                    if (!permissionGranted) {
                      const perm = await requestPermission();
                      permissionGranted = perm === 'granted';
                    }
                    if (permissionGranted) {
                      sendNotification({ title, body: summary, sound: 'default' });
                    }
                  }).catch(e => console.warn('[Notification] Native toast error:', e));
                })
                .catch(e => console.warn('[Notification] Plugin unavailable:', e));
            }
            break;
          }
            
          case 'switch_view':
            useAgentStore.getState().setActiveView(data.view);
            if (data.search_query) {
              useAgentStore.getState().setBrowserSearchQuery(data.search_query);
            }
            break;
            
          case 'done': {
            // Finished current task
            finishTask(data.task_id);
            addActivityEvent({ type: 'done', message: 'Task complete', taskId: data.task_id });
            
            // Bug 5 fix — use sessionTtsEnabled (per-chat mute state) instead of chatTtsEnabled (global setting)
            const state = useAgentStore.getState();
            if (state.sessionTtsEnabled && state.messages.length > 0) {
              const lastMsg = state.messages.find(message => message.role === 'assistant' && message.taskId === data.task_id);
              if (lastMsg?.content) {
                const utterance = new SpeechSynthesisUtterance(lastMsg.content);
                // Optional: set a cool robotic/AI voice if available
                const voices = window.speechSynthesis.getVoices();
                const preferredVoice = voices.find(v => v.name.includes('Microsoft Mark') || v.name.includes('Google UK English Male')) || voices[0];
                if (preferredVoice) utterance.voice = preferredVoice;
                window.speechSynthesis.speak(utterance);
              }
            }
            break;
          }
            
          case 'error':
            finishTask(data.task_id);
            addActivityEvent({ type: 'error', message: data.message, taskId: data.task_id });
            toast.error(data.message || 'An error occurred');
            break;
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };
  }, [setConnected, updateMessage, setAgentActive, startTask, finishTask, addActivityEvent, addNotification, setNotificationDrawerOpen]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      toast.error('Not connected to NexusAI core');
      return;
    }
    
    const taskId = crypto.randomUUID();
    
    // Add user message to UI immediately
    addMessage({
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content,
      timestamp: Date.now(),
      taskId,
    });
    
    // Create empty assistant placeholder
    addMessage({
      id: Math.random().toString(36).substring(7),
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      taskId,
    });
    
    startTask(taskId);
    
    // Send to backend
    ws.current.send(JSON.stringify({
      type: 'message',
      content,
      task_id: taskId,
    }));
  }, [addMessage, startTask]);

  const { setSendMessage, setCancelAllTasks, setClearServerSession } = useAgentStore();
  
  useEffect(() => {
    setSendMessage(sendMessage);
  }, [sendMessage, setSendMessage]);

  useEffect(() => {
    setClearServerSession(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'clear_session' }));
      }
    });
  }, [setClearServerSession]);

  useEffect(() => {
    setCancelAllTasks(() => {
      const { activeTaskIds } = useAgentStore.getState();
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      activeTaskIds.forEach(taskId => ws.current?.send(JSON.stringify({ type: 'cancel_task', task_id: taskId })));
    });
  }, [setCancelAllTasks]);

  return { sendMessage };
};
