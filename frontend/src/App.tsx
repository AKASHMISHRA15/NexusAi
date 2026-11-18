import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, handleGoogleRedirectResult } from './lib/firebase';
import { Toaster } from 'sonner';
import { Activity, BatteryCharging, Bell, Cpu, Mic, Moon, Search, Wifi, ArrowLeft, Home } from 'lucide-react';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatWindow } from './components/chat/ChatWindow';
import { AgentActivityPanel } from './components/activity/AgentActivityPanel';
import { SkillsPanel } from './components/skills/SkillsPanel';
import { SettingsModal } from './components/settings/SettingsModal';
import { AuthPage } from './components/auth/AuthPage';
import { LandingPage } from './components/landing/LandingPage';
import { useAgentStore } from './stores/agentStore';
import { useAgentWebSocket } from './hooks/useAgentWebSocket';
import { BrowserPage, EmailPage, FileExplorerPage, LogsPage, MapsPage, MusicPage, VoiceAssistantPage, WeatherDashboardPage, WhatsAppPage, ChatHistoryPage, NexusMultimediaPage } from './components/workspace/WorkspacePages';
import { NotificationDrawer } from './components/workspace/NotificationDrawer';

// Error boundary to catch runtime crashes and show a meaningful message instead of a black screen
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1016', color: '#fff', gap: 16, padding: 32 }}>
          <h2 style={{ color: '#ef4444', fontSize: 24 }}>Something went wrong</h2>
          <p style={{ color: '#a3a8b7', maxWidth: 600, textAlign: 'center' }}>{this.state.error}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }} style={{ background: '#7367f0', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const TopNavStatus: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const [networkRate, setNetworkRate] = useState<string>('—');
  const { systemMetrics, setSystemMetrics, unreadNotificationsCount, setNotificationDrawerOpen, goBack, goHome, viewHistory } = useAgentStore();
  const previousNetwork = useRef<{ received: number; at: number } | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setTime(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8765/api/system');
        const data = await response.json();
        if (!mounted || !data.system) return;
        const now = Date.now();
        const received = data.system.network_bytes_recv || 0;
        if (previousNetwork.current) {
          const seconds = (now - previousNetwork.current.at) / 1000;
          const bytesPerSecond = Math.max(0, (received - previousNetwork.current.received) / seconds);
          setNetworkRate(bytesPerSecond >= 1024 * 1024 ? `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s` : `${Math.round(bytesPerSecond / 1024)} KB/s`);
        }
        previousNetwork.current = { received, at: now };
        setSystemMetrics(data.system);
      } catch { /* Backend status is optional while the dashboard is loading. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [setSystemMetrics]);
  const cpu = systemMetrics?.cpu_percent ?? '—';
  const memory = systemMetrics?.memory_percent ?? '—';
  const battery = systemMetrics?.battery_percent;
  return <header className="nova-topbar">
    <div className="nova-nav-buttons" style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
      <button 
        onClick={goBack} 
        disabled={viewHistory.length === 0}
        title="Go Back"
        style={{ 
          background: 'transparent', border: 'none', color: viewHistory.length === 0 ? '#4e5f82' : '#87a8ff', 
          cursor: viewHistory.length === 0 ? 'default' : 'pointer', padding: '6px', borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
        <ArrowLeft size={18} />
      </button>
      <button 
        onClick={goHome}
        title="Dashboard"
        style={{ 
          background: 'transparent', border: 'none', color: '#87a8ff', cursor: 'pointer',
          padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
        <Home size={18} />
      </button>
    </div>
    <label className="nova-search"><Search size={16} /><input placeholder="Search files, emails, commands, or ask Nexus..." /></label>
    <div className="nova-top-stats"><span title="Live CPU usage"><Cpu size={14} /> {cpu}% <i><b style={{ width: `${cpu}%` }} /></i></span><span title="Live memory usage"><Activity size={14} /> {memory}% <i><b style={{ width: `${memory}%` }} /></i></span><span title="Live download rate"><Wifi size={14} /> {networkRate}</span><span title="Battery level"><BatteryCharging size={14} /> {battery ?? '—'}%</span></div>
    <div className="nova-top-actions"><span className="nova-idle"><Mic size={13} /> IDLE</span><button title="Theme"><Moon size={15} /></button><button title="Notifications" className="nova-notification" onClick={() => setNotificationDrawerOpen(true)}><Bell size={15} />{unreadNotificationsCount > 0 && <b>{unreadNotificationsCount}</b>}</button><time>{time.toLocaleTimeString([], { hour12: false })}</time></div>
  </header>;
};

const AgentWorkspace: React.FC = () => {
  const { activeView, activityStream, isAgentActive } = useAgentStore(); const [loading, setLoading] = useState(true); useAgentWebSocket();
  useEffect(() => { const timer = window.setTimeout(() => setLoading(false), 1800); return () => window.clearTimeout(timer); }, []);
  if (loading) return <div className="splash-screen"><div className="splash-logo">N</div><h1 className="splash-name">NexusAI</h1><p className="splash-tagline">Initializing AI Operating System...</p><div className="splash-progress"><div className="splash-progress-bar" /></div></div>;
  
  const showActivity = activityStream.length > 0 || isAgentActive;
  const page = activeView === 'dashboard' ? <ChatWindow dashboardMode /> : activeView === 'chat' ? <><ChatWindow />{showActivity && <AgentActivityPanel />}</> : activeView === 'skills' ? <SkillsPanel /> : activeView === 'files' ? <FileExplorerPage /> : activeView === 'browser' ? <BrowserPage /> : activeView === 'email' ? <EmailPage /> : activeView === 'whatsapp' ? <WhatsAppPage /> : activeView === 'music' ? <MusicPage /> : activeView === 'maps' ? <MapsPage /> : activeView === 'weather' ? <WeatherDashboardPage /> : activeView === 'history' ? <ChatHistoryPage /> : activeView === 'nexus-view' ? <NexusMultimediaPage /> : activeView === 'voice' ? <VoiceAssistantPage /> : <LogsPage />;
  return <div className="nova-workspace"><Sidebar /><div className="nova-workspace-body"><TopNavStatus /><main className="nova-workspace-content">{page}</main></div><SettingsModal /><NotificationDrawer /></div>;
};

import { exchangeCodeForToken } from './lib/spotify';
import { exchangeGoogleCode } from './lib/google-oauth';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import { sendLoginOtp } from './lib/auth-otp';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const App: React.FC = () => { 
  const { appScreen, setAuthenticated, setAppScreen, setActiveView, setSpotifyToken } = useAgentStore(); 

  useEffect(() => {
    // Listen for OAuth redirects intercepted by the Rust server
    const setupListener = async () => {
      return await listen<string>('oauth_callback', async (event) => {
        // event.payload is the raw HTTP path, e.g., "/callback?code=...&state=google_oauth"
        const url = new URL(`http://localhost${event.payload}`);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        // The browser cannot reliably close itself after a cross-site redirect,
        // so put the desktop app back in front as soon as it reaches localhost.
        try {
          await getCurrentWindow().show();
          await getCurrentWindow().setFocus();
        } catch (error) {
          console.warn('Could not foreground Nexus AI after OAuth:', error);
        }

        if (!code) {
          console.error('OAuth callback did not include an authorization code.');
          return;
        }

        if (state === 'google_app' || state === 'google_oauth') {
          // ── Google OAuth callback ──────────────────────────────────────────────
          const idToken = await exchangeGoogleCode(code, false);
          if (idToken) {
            // Read the context set by the button that triggered Google OAuth
            const googleContext = sessionStorage.getItem('nexus_google_auth_context') || 'login';
            sessionStorage.removeItem('nexus_google_auth_context');

            try {
              const credential = GoogleAuthProvider.credential(idToken);
              const result = await signInWithCredential(auth, credential);
              const email = result.user.email;
              if (!email) throw new Error('Google did not provide an email address.');

              // additionalUserInfo.isNewUser = true means first-time Google sign-in
              const isNewUser = (result as any).additionalUserInfo?.isNewUser ?? false;

              if (googleContext === 'register' && !isNewUser) {
                // User tried to register with an already-existing Google account
                await signOut(auth).catch(() => undefined);
                setAppScreen('auth');
                // Use sonner toast for the error notification
                import('sonner').then(({ toast }) => {
                  toast.error('This Google account is already registered. Please sign in instead, or use a different Google account.', {
                    duration: 6000,
                    position: 'top-center',
                  });
                });
                return;
              }

              if (googleContext === 'login' && isNewUser) {
                // User tried to login with a brand-new Google account (no existing account)
                await signOut(auth).catch(() => undefined);
                setAppScreen('auth');
                import('sonner').then(({ toast }) => {
                  toast.error('No account found for this Google account. Please create an account first.', {
                    duration: 6000,
                    position: 'top-center',
                  });
                });
                return;
              }

              if (isNewUser && googleContext === 'register') {
                // Brand new user via register flow → ask for display name
                setAppScreen('auth');
                // Signal AuthPage to show the google_name view
                sessionStorage.setItem('nexus_google_new_user', 'true');
                window.dispatchEvent(new Event('nexus_google_new_user'));
              } else {
                // Existing user logging in — proceed to OTP verification
                sessionStorage.setItem('nexus_otp_required', 'true');
                await sendLoginOtp(email);
                sessionStorage.setItem('nexus_otp_pending_email', email);
                setAppScreen('auth');
                window.dispatchEvent(new Event('nexus_otp_pending'));
              }
            } catch (err) {
              sessionStorage.removeItem('nexus_otp_required');
              await signOut(auth).catch(() => undefined);
              console.error('Firebase signInWithCredential failed:', err);
            }
          }
        } else if (state === 'google_gmail') {
          // Gmail authorization must never navigate away from the Email page.
          await exchangeGoogleCode(code, true);
        } else if (state === 'spotify_oauth') {
          // ── Spotify PKCE callback ──────────────────────────────────────────────
          const token = await exchangeCodeForToken(code);
          if (token) {
            setSpotifyToken(token);
            setAppScreen('agent');
            setActiveView('music');
          } else {
            console.error('Spotify did not return an access token.');
          }
        } else {
          console.error('Ignoring OAuth callback with an unknown state:', state);
        }
      });
    };

    let unlisten: (() => void) | undefined;
    setupListener().then(f => unlisten = f);

    return () => {
      if (unlisten) unlisten();
    };
  }, [setAppScreen, setActiveView, setSpotifyToken]);

  // Handle Google sign-in redirect result at the top level.
  // This runs once when the app starts — if the user was just redirected
  // back from Google OAuth, Firebase will resolve the pending credential here.
  useEffect(() => {
    handleGoogleRedirectResult()
      .then((result) => {
        if (result?.user) {
          setAuthenticated(true);
          if (appScreen === 'auth' || appScreen === 'landing') {
            setAppScreen('landing');
          }
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Email/password users are signed into Firebase before their OTP is
        // checked. Keep that temporary Firebase session out of the workspace.
        if (sessionStorage.getItem('nexus_otp_required') === 'true') {
          setAuthenticated(false);
          return;
        }
        setAuthenticated(true);
        if (appScreen === 'auth') {
          setAppScreen('landing');
        }
      } else if (localStorage.getItem('nexus_google_session') !== 'true') {
        setAuthenticated(false);
      }
    });
    return () => unsubscribe();
  }, [setAuthenticated, appScreen, setAppScreen]);

  return <ErrorBoundary><><Toaster position="top-center" theme="dark" />{appScreen === 'landing' && <LandingPage />}{appScreen === 'auth' && <AuthPage />}{appScreen === 'agent' && <AgentWorkspace />}</></ErrorBoundary>; 
};
export default App;
