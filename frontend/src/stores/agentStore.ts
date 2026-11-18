import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  taskId?: string;
}

export interface ChatSession {
  id: string;
  name: string;
  date: number;
  messages: Message[];
}

export interface StreamEvent {
  id: string;
  type: 'thinking' | 'tool_start' | 'tool_end' | 'stream' | 'done' | 'error';
  message?: string;
  text?: string;
  tool?: string;
  success?: boolean;
  taskId?: string;
  timestamp: number;
}

export type WorkspaceView = 'dashboard' | 'chat' | 'skills' | 'files' | 'browser' | 'email' | 'whatsapp' | 'music' | 'maps' | 'weather' | 'voice' | 'logs' | 'history' | 'nexus-view';
export interface AppNotification { id: string; title: string; body: string; appName?: string; timestamp: number; }

interface AgentState {
  // Connection
  isConnected: boolean;
  setConnected: (status: boolean) => void;
  systemMetrics: Record<string, any> | null;
  setSystemMetrics: (metrics: Record<string, any>) => void;
  
  // Authentication
  isAuthenticated: boolean;
  setAuthenticated: (authenticated: boolean) => void;
  appScreen: 'landing' | 'auth' | 'agent';
  setAppScreen: (screen: 'landing' | 'auth' | 'agent') => void;

  spotifyToken: string | null;
  setSpotifyToken: (token: string | null) => void;
  
  // Chat History
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateMessage: (taskId: string, content: string) => void;
  clearMessages: () => void;
  chats: ChatSession[];
  saveChat: () => void;
  loadChat: (id: string) => void;
  deleteChat: (id: string) => void;
  newChat: () => void;
  
  // Agent Activity (Terminal Panel)
  isAgentActive: boolean;
  setAgentActive: (active: boolean) => void;
  activeTaskIds: string[];
  startTask: (taskId: string) => void;
  finishTask: (taskId: string) => void;
  activityStream: StreamEvent[];
  addActivityEvent: (event: Omit<StreamEvent, 'id' | 'timestamp'>) => void;
  clearActivityStream: () => void;
  
  // UI State
  viewHistory: WorkspaceView[];
  activeView: WorkspaceView;
  setActiveView: (view: WorkspaceView) => void;
  goBack: () => void;
  goHome: () => void;
  browserSearchQuery: string;
  setBrowserSearchQuery: (query: string) => void;
  nexusView: { path: string, type: string, name: string } | null;
  setNexusView: (media: { path: string, type: string, name: string } | null) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  trashedNotifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp'>) => boolean;
  clearNotifications: () => void;
  clearUnreadNotifications: () => void;
  deleteNotification: (id: string) => void;
  recoverNotification: (id: string) => void;
  isNotificationDrawerOpen: boolean;
  setNotificationDrawerOpen: (open: boolean) => void;
  nativeApps: { name: string; path: string; category?: string }[];
  setNativeApps: (apps: { name: string; path: string; category?: string }[]) => void;
  
  // Voice Settings
  chatTtsEnabled: boolean;
  sessionTtsEnabled: boolean;
  notificationTtsEnabled: boolean;
  setChatTtsEnabled: (enabled: boolean) => void;
  setSessionTtsEnabled: (enabled: boolean) => void;
  setNotificationTtsEnabled: (enabled: boolean) => void;
  
  // Notification Behaviors
  appReadNotifications: boolean;
  setAppReadNotifications: (enabled: boolean) => void;
  notificationScope: 'skill_modules' | 'all';
  setNotificationScope: (scope: 'skill_modules' | 'all') => void;
  notificationOutput: 'tts' | 'show_only';
  setNotificationOutput: (output: 'tts' | 'show_only') => void;
  
  // Actions
  sendMessage: (content: string) => void;
  setSendMessage: (fn: (content: string) => void) => void;
  clearServerSession: () => void;
  setClearServerSession: (fn: () => void) => void;
  cancelAllTasks: () => void;
  setCancelAllTasks: (fn: () => void) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  // Connection
  isConnected: false,
  setConnected: (status) => set({ isConnected: status }),
  systemMetrics: null,
  setSystemMetrics: (systemMetrics) => set({ systemMetrics }),
  
  // Chat — messages are persisted to sessionStorage so they survive F5 refreshes
  // but clear automatically when the Tauri window is closed and reopened.
  messages: (() => {
    try { return JSON.parse(sessionStorage.getItem('nexus_current_messages') || '[]'); }
    catch { return []; }
  })(),
  chats: JSON.parse(localStorage.getItem('nexus_chats') || '[]'),
  addMessage: (msg) => set((state) => {
    const messages = [...state.messages, msg];
    try { sessionStorage.setItem('nexus_current_messages', JSON.stringify(messages)); } catch {}
    return { messages };
  }),
  updateMessage: (taskId, content) => set((state) => {
    const messages = [...state.messages];
    const messageIndex = messages.findIndex(message => message.role === 'assistant' && message.taskId === taskId);
    if (messageIndex >= 0) {
      messages[messageIndex] = { ...messages[messageIndex], content: messages[messageIndex].content + content };
    } else {
      messages.push({
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: content,
        timestamp: Date.now(),
        taskId,
      });
    }
    try { sessionStorage.setItem('nexus_current_messages', JSON.stringify(messages)); } catch {}
    return { messages };
  }),
  clearMessages: () => {
    try { sessionStorage.removeItem('nexus_current_messages'); } catch {}
    set({ messages: [] });
  },
  saveChat: () => set((state) => {
    if (state.messages.length === 0) return state;
    // Use the first user message or a snippet of it as the chat name
    const firstUserMsg = state.messages.find(m => m.role === 'user');
    const name = firstUserMsg ? firstUserMsg.content.slice(0, 30) + '...' : 'Saved Chat';
    
    const newChat: ChatSession = {
      id: crypto.randomUUID(),
      name,
      date: Date.now(),
      messages: [...state.messages]
    };
    const updatedChats = [newChat, ...state.chats];
    localStorage.setItem('nexus_chats', JSON.stringify(updatedChats));
    return { chats: updatedChats };
  }),
  loadChat: (id) => set((state) => {
    const chatToLoad = state.chats.find(c => c.id === id);
    if (chatToLoad) {
      try { sessionStorage.setItem('nexus_current_messages', JSON.stringify(chatToLoad.messages)); } catch {}
      return { messages: [...chatToLoad.messages], activeView: 'chat', isAgentActive: false };
    }
    return state;
  }),
  deleteChat: (id) => set((state) => {
    const updatedChats = state.chats.filter(c => c.id !== id);
    localStorage.setItem('nexus_chats', JSON.stringify(updatedChats));
    return { chats: updatedChats };
  }),
  newChat: () => set((state) => {
    if (state.clearServerSession) {
      state.clearServerSession();
    }
    try { sessionStorage.removeItem('nexus_current_messages'); } catch {}
    return { 
      messages: [], 
      activeView: 'chat', 
      isAgentActive: false, 
      activityStream: [], 
      activeTaskIds: [],
      sessionTtsEnabled: state.chatTtsEnabled
    };
  }),
  
  // Activity Stream
  isAgentActive: false,
  setAgentActive: (active) => set({ isAgentActive: active }),
  activeTaskIds: [],
  startTask: (taskId) => set((state) => {
    const activeTaskIds = state.activeTaskIds.includes(taskId) ? state.activeTaskIds : [...state.activeTaskIds, taskId];
    return { activeTaskIds, isAgentActive: activeTaskIds.length > 0 };
  }),
  finishTask: (taskId) => set((state) => {
    const activeTaskIds = state.activeTaskIds.filter(id => id !== taskId);
    return { activeTaskIds, isAgentActive: activeTaskIds.length > 0 };
  }),
  activityStream: [],
  addActivityEvent: (event) => set((state) => ({
    activityStream: [...state.activityStream, { 
      ...event, 
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now() 
    }]
  })),
  clearActivityStream: () => set({ activityStream: [] }),
  
  // UI State
  viewHistory: (() => {
    try { return JSON.parse(sessionStorage.getItem('viewHistory') || '[]'); }
    catch { return []; }
  })(),
  activeView: (sessionStorage.getItem('activeView') as WorkspaceView) || 'dashboard',
  setActiveView: (view) => set((state) => {
    if (state.activeView === view) return state; // Don't push duplicate
    const newHistory = [...state.viewHistory, state.activeView];
    sessionStorage.setItem('viewHistory', JSON.stringify(newHistory));
    sessionStorage.setItem('activeView', view);
    return { activeView: view, viewHistory: newHistory };
  }),
  goBack: () => set((state) => {
    if (state.viewHistory.length === 0) return state;
    const newHistory = [...state.viewHistory];
    const prevView = newHistory.pop()!;
    sessionStorage.setItem('viewHistory', JSON.stringify(newHistory));
    sessionStorage.setItem('activeView', prevView);
    return { activeView: prevView, viewHistory: newHistory };
  }),
  goHome: () => set(() => {
    sessionStorage.setItem('viewHistory', '[]');
    sessionStorage.setItem('activeView', 'dashboard');
    return { activeView: 'dashboard', viewHistory: [] };
  }),
  browserSearchQuery: '',
  setBrowserSearchQuery: (query) => set({ browserSearchQuery: query }),
  nexusView: null,
  setNexusView: (nexusView) => set({ nexusView }),
  isSettingsOpen: false,
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  notifications: [],
  unreadNotificationsCount: 0,
  trashedNotifications: [],
  addNotification: (notification) => {
    let wasAdded = false;
    set((state) => {
      const now = Date.now();
      // Basic deduplication: ignore if identical to any of the last 3 notifications within the last 10 seconds
      const isDuplicate = state.notifications.slice(0, 3).some(n => 
        n.title === notification.title && 
        n.body === notification.body &&
        n.appName === notification.appName &&
        (now - n.timestamp) < 10000
      );
      if (isDuplicate) return state;

      wasAdded = true;
      return { 
        notifications: [{ ...notification, id: crypto.randomUUID(), timestamp: now }, ...state.notifications].slice(0, 50),
        unreadNotificationsCount: state.unreadNotificationsCount + 1
      };
    });
    return wasAdded;
  },
  clearNotifications: () => set((state) => ({ 
    trashedNotifications: [...state.notifications, ...state.trashedNotifications],
    notifications: [],
    unreadNotificationsCount: 0
  })),
  clearUnreadNotifications: () => set({ unreadNotificationsCount: 0 }),
  deleteNotification: (id) => set((state) => {
    const notif = state.notifications.find(n => n.id === id);
    if (!notif) return state;
    return {
      notifications: state.notifications.filter(n => n.id !== id),
      trashedNotifications: [notif, ...state.trashedNotifications]
    };
  }),
  recoverNotification: (id) => set((state) => {
    const notif = state.trashedNotifications.find(n => n.id === id);
    if (!notif) return state;
    return {
      trashedNotifications: state.trashedNotifications.filter(n => n.id !== id),
      notifications: [notif, ...state.notifications].sort((a,b) => b.timestamp - a.timestamp)
    };
  }),
  isNotificationDrawerOpen: false,
  setNotificationDrawerOpen: (isNotificationDrawerOpen) => set({ isNotificationDrawerOpen }),
  nativeApps: JSON.parse(localStorage.getItem('skill_module_pinned_apps_v1') || '[]'),
  setNativeApps: (apps) => {
    localStorage.setItem('skill_module_pinned_apps_v1', JSON.stringify(apps));
    set({ nativeApps: apps });
    
    // Sync with backend so the AI agent knows about the user's custom apps
    const api = localStorage.getItem('nexus_api_host') || 'http://127.0.0.1:8765';
    fetch(`${api}/api/custom-apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apps)
    }).catch(err => console.error("Failed to sync custom apps to agent backend:", err));
  },
  
  // Authentication
  isAuthenticated: localStorage.getItem('nexus_google_session') === 'true',
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  appScreen: (sessionStorage.getItem('appScreen') as any) || 'landing',
  setAppScreen: (appScreen) => {
    sessionStorage.setItem('appScreen', appScreen);
    set({ appScreen });
  },

  spotifyToken: localStorage.getItem('spotify_token'),
  setSpotifyToken: (token) => {
    if (token) localStorage.setItem('spotify_token', token);
    else localStorage.removeItem('spotify_token');
    set({ spotifyToken: token });
  },

  // Voice Settings
  chatTtsEnabled: localStorage.getItem('chatTtsEnabled') === 'true' || localStorage.getItem('ttsEnabled') === 'true',
  sessionTtsEnabled: localStorage.getItem('chatTtsEnabled') === 'true' || localStorage.getItem('ttsEnabled') === 'true',
  notificationTtsEnabled: localStorage.getItem('notificationTtsEnabled') === 'true',
  setChatTtsEnabled: (enabled) => {
    localStorage.setItem('chatTtsEnabled', String(enabled));
    if (!enabled) {
      window.speechSynthesis.cancel();
    }
    set({ chatTtsEnabled: enabled, sessionTtsEnabled: enabled });
  },
  setSessionTtsEnabled: (enabled) => {
    if (!enabled) window.speechSynthesis.cancel();
    set({ sessionTtsEnabled: enabled });
  },
  setNotificationTtsEnabled: (enabled) => {
    localStorage.setItem('notificationTtsEnabled', String(enabled));
    set({ notificationTtsEnabled: enabled });
  },

  // Notification Behaviors
  appReadNotifications: localStorage.getItem('appReadNotifications') === 'true',
  setAppReadNotifications: (enabled) => {
    localStorage.setItem('appReadNotifications', String(enabled));
    set({ appReadNotifications: enabled });
  },
  notificationScope: (localStorage.getItem('notificationScope') as any) || 'skill_modules',
  setNotificationScope: (scope) => {
    localStorage.setItem('notificationScope', scope);
    set({ notificationScope: scope });
  },
  notificationOutput: (localStorage.getItem('notificationOutput') as any) || 'show_only',
  setNotificationOutput: (output) => {
    localStorage.setItem('notificationOutput', output);
    if (output === 'show_only') window.speechSynthesis.cancel();
    set({ notificationOutput: output });
  },
  
  sendMessage: () => { console.warn("sendMessage not initialized yet"); },
  setSendMessage: (fn) => set({ sendMessage: fn }),
  clearServerSession: () => { console.warn("clearServerSession not initialized yet"); },
  setClearServerSession: (fn) => set({ clearServerSession: fn }),
  cancelAllTasks: () => {},
  setCancelAllTasks: (fn) => set({ cancelAllTasks: fn }),
}));
