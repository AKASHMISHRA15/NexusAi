import React, { useState, useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { 
  X, AlertCircle, Settings as SettingsIcon, Monitor, 
  Cpu, Lock, RefreshCw, Power, PowerOff, Shield, Database, LayoutDashboard, MessageCircle
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

export const SettingsModal: React.FC = () => {
  const { 
    isSettingsOpen, setSettingsOpen, 
    chatTtsEnabled, setChatTtsEnabled,
    appReadNotifications, setAppReadNotifications,
    notificationScope, setNotificationScope,
    notificationOutput, setNotificationOutput
  } = useAgentStore();
  
  const [activeTab, setActiveTab] = useState<'app' | 'system'>('system');

  // AI Models State
  const [lmModels, setLmModels] = useState<string[]>([]);
  const [selectedLmModel, setSelectedLmModel] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('local');
  const [customLocalUrl, setCustomLocalUrl] = useState('http://localhost:11434/v1');
  
  // Hardware State
  const [volume, setVolume] = useState(75);
  const [brightness, setBrightness] = useState(80);

  useEffect(() => {
    if (isSettingsOpen && (selectedProvider === 'local' || selectedProvider === 'webllm')) {
      const baseUrl = selectedProvider === 'local' ? 'http://127.0.0.1:1234/v1' : customLocalUrl;
      const url = baseUrl.endsWith('/') ? `${baseUrl}models` : `${baseUrl}/models`;
      
      // Fetch LM models
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            const models = data.data.map((m: any) => m.id);
            setLmModels(models);
            if (models.length > 0 && !models.includes(selectedLmModel)) {
              setSelectedLmModel(models[0]);
            }
          }
        }).catch(() => {
          console.log(`Failed to fetch models from ${url}`);
          setLmModels([]);
        });
    }
  }, [isSettingsOpen, selectedProvider, customLocalUrl]);

  if (!isSettingsOpen) return null;

  const handleSystemAction = async (action: string) => {
    try {
      await invoke('os_power_action', { action });
      toast.success(`Action '${action}' initiated.`);
    } catch (e: any) {
      toast.error(`Action failed: ${e.message || e}`);
    }
  };

  const handleAppAction = async (action: string) => {
    try {
      await invoke('app_power_action', { action });
    } catch (e: any) {
      toast.error(`App action failed: ${e.message || e}`);
    }
  };

  const handleVolumeChange = async (val: number) => {
    setVolume(val);
    try {
      await invoke('set_system_volume', { level: val });
    } catch (e) {}
  };

  const handleBrightnessChange = async (val: number) => {
    setBrightness(val);
    try {
      await invoke('set_system_brightness', { level: val });
    } catch (e) {}
  };

  return (
    <div className="modal-backdrop" onClick={() => setSettingsOpen(false)} style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '90vw', maxWidth: '1200px', height: '85vh', display: 'flex', flexDirection: 'row', padding: 0, backgroundColor: '#0f1016', borderRadius: '16px', overflow: 'hidden', border: '1px solid #2a2c37' }}>
        
        {/* Sidebar */}
        <div style={{ width: '250px', backgroundColor: '#15161d', borderRight: '1px solid #2a2c37', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid #2a2c37' }}>
            <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SettingsIcon size={20} className="text-[#7367f0]" />
              Settings
            </h2>
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => setActiveTab('app')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'app' ? '#7367f020' : 'transparent', color: activeTab === 'app' ? '#7367f0' : '#a3a8b7', cursor: 'pointer', textAlign: 'left', fontWeight: 600, transition: 'all 0.2s' }}>
              <LayoutDashboard size={18} />
              App Settings
            </button>
            <button 
              onClick={() => setActiveTab('system')}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'system' ? '#7367f020' : 'transparent', color: activeTab === 'system' ? '#7367f0' : '#a3a8b7', cursor: 'pointer', textAlign: 'left', fontWeight: 600, transition: 'all 0.2s' }}>
              <Monitor size={18} />
              System Settings
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a2c37' }}>
            <div>
              <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{activeTab === 'system' ? 'System Settings' : 'App Settings'}</h1>
              <p style={{ color: '#a3a8b7', fontSize: '14px', margin: 0 }}>
                {activeTab === 'system' ? 'Manage device inputs, permissions, hardware controls, and configurations' : 'Manage Nexus AI models, connections, and app behaviors'}
              </p>
            </div>
            <button onClick={() => setSettingsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#a3a8b7', cursor: 'pointer', padding: '8px', borderRadius: '50%' }} className="hover:bg-white/10 hover:text-white transition-all">
              <X size={24} />
            </button>
          </div>

          <div style={{ padding: '32px', overflowY: 'auto', flex: 1, backgroundColor: '#0f1016' }}>
            
            {activeTab === 'system' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                
                {/* General Hardware Control */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '24px', border: '1px solid #2a2c37' }}>
                  <h3 style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '16px' }}>
                    <Cpu size={18} color="#7367f0" /> General Hardware Control
                  </h3>
                  
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                      <span style={{ color: '#a3a8b7' }}>Audio Volume Gain</span>
                      <span style={{ color: '#7367f0', fontWeight: 'bold' }}>{volume}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={volume} onChange={(e) => handleVolumeChange(parseInt(e.target.value))} 
                           style={{ width: '100%', height: '6px', background: '#2a2c37', borderRadius: '4px', cursor: 'pointer', accentColor: '#7367f0' }} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                      <span style={{ color: '#a3a8b7' }}>Display Brightness Nits</span>
                      <span style={{ color: '#ce9ffc', fontWeight: 'bold' }}>{brightness}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={brightness} onChange={(e) => handleBrightnessChange(parseInt(e.target.value))} 
                           style={{ width: '100%', height: '6px', background: '#2a2c37', borderRadius: '4px', cursor: 'pointer', accentColor: '#ce9ffc' }} />
                  </div>
                </div>

                {/* Security & Access Permissions */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '24px', border: '1px solid #2a2c37', gridRow: 'span 2' }}>
                  <h3 style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '16px' }}>
                    <Shield size={18} color="#10b981" /> Security & Access Permissions
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {['Email Access', 'WhatsApp Access', 'File Access', 'Browser Access', 'Microphone', 'Camera', 'OS Notification Access'].map((perm, i) => (
                      <div key={perm} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: i === 6 ? 'none' : '1px solid #2a2c37' }}>
                        <span style={{ color: '#e9edf5', fontSize: '14px' }}>{perm}</span>
                        <select style={{ background: 'transparent', border: '1px solid #2a2c37', color: '#a3a8b7', fontSize: '12px', borderRadius: '6px', padding: '4px 8px', outline: 'none' }}>
                          <option>Granted</option>
                          <option>Ask every time</option>
                          <option>Denied</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* OS Power Controls */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '24px', border: '1px solid #2a2c37' }}>
                  <h3 style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '16px' }}>
                    <Monitor size={18} color="#f59e0b" /> OS Power Controls
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button onClick={() => handleSystemAction('reboot')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: '#2a2c37', color: '#fff', fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'all 0.2s' }}>
                      <RefreshCw size={16} /> Reboot System
                    </button>
                    <button onClick={() => handleSystemAction('shutdown')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Power size={16} /> Power Off
                    </button>
                    <button onClick={() => handleSystemAction('update_restart')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(115, 103, 240, 0.15)', color: '#ce9ffc', border: '1px solid rgba(115, 103, 240, 0.3)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <RefreshCw size={16} /> Update and Restart
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'app' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                
                {/* AI Models Setup */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '24px', border: '1px solid #2a2c37', gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', margin: 0 }}>
                      <Database size={18} color="#7367f0" /> AI Models & Providers
                    </h3>
                    <select 
                      value={selectedProvider} 
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      style={{ background: '#15161d', border: '1px solid #7367f0', borderRadius: '8px', padding: '6px 12px', color: '#fff', outline: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                    >
                      <option value="local">Local (Nexus Hub / LM Studio)</option>
                      <option value="webllm">Local (WebLLM / Device Target)</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google Gemini</option>
                    </select>
                  </div>
                  
                  {selectedProvider === 'local' || selectedProvider === 'webllm' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h4 style={{ color: '#a3a8b7', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #2a2c37', paddingBottom: '8px' }}>
                          {selectedProvider === 'webllm' ? 'WebLLM / Device Target Setup' : 'Nexus Provided Setup'}
                        </h4>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#a3a8b7', marginBottom: '4px' }}>
                            {selectedProvider === 'webllm' ? 'Custom Target URL (e.g. localhost:11434/v1)' : 'Local Provider URL (Nexus Hub)'}
                          </label>
                          <input 
                            type="text" 
                            value={selectedProvider === 'webllm' ? customLocalUrl : 'http://127.0.0.1:1234/v1'} 
                            onChange={(e) => selectedProvider === 'webllm' && setCustomLocalUrl(e.target.value)}
                            readOnly={selectedProvider !== 'webllm'}
                            style={{ 
                              width: '100%', background: '#15161d', border: '1px solid #2a2c37', 
                              borderRadius: '8px', padding: '8px 16px', 
                              color: selectedProvider === 'webllm' ? '#fff' : '#a3a8b7', 
                              opacity: selectedProvider === 'webllm' ? 1 : 0.7, 
                              cursor: selectedProvider === 'webllm' ? 'text' : 'not-allowed', 
                              outline: 'none' 
                            }} 
                          />
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#a3a8b7', marginBottom: '4px' }}>Select LM Studio Model (Device Target)</label>
                          <select 
                            value={selectedLmModel} 
                            onChange={(e) => setSelectedLmModel(e.target.value)}
                            style={{ width: '100%', background: '#15161d', border: '1px solid #2a2c37', borderRadius: '8px', padding: '8px 16px', color: '#fff', outline: 'none', cursor: 'pointer' }}
                          >
                            {lmModels.length > 0 ? (
                              lmModels.map(m => <option key={m} value={m}>{m}</option>)
                            ) : (
                              <option>No models found at this URL.</option>
                            )}
                          </select>
                          <p style={{ fontSize: '10px', color: '#a3a8b7', marginTop: '4px' }}>Nexus AI will auto-detect the optimal model for your OS needs from this list.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h4 style={{ color: '#a3a8b7', fontWeight: 600, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #2a2c37', paddingBottom: '8px' }}>{selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)} Setup</h4>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#a3a8b7', marginBottom: '4px' }}>Custom API URL / Endpoint</label>
                          <input type="text" placeholder={`e.g. https://api.${selectedProvider}.com/v1`} style={{ width: '100%', background: '#15161d', border: '1px solid #2a2c37', borderRadius: '8px', padding: '8px 16px', color: '#fff', outline: 'none' }} />
                          <p style={{ fontSize: '10px', color: '#a3a8b7', marginTop: '4px' }}>The endpoint URL where requests are sent.</p>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#a3a8b7', marginBottom: '4px' }}>API Key / Access Token</label>
                          <input type="password" placeholder="sk-..." style={{ width: '100%', background: '#15161d', border: '1px solid #2a2c37', borderRadius: '8px', padding: '8px 16px', color: '#fff', outline: 'none' }} />
                          <p style={{ fontSize: '10px', color: '#a3a8b7', marginTop: '4px' }}>Your secret key to authenticate requests.</p>
                        </div>

                        <button onClick={() => toast.success('API Key Saved')} style={{ width: '100%', marginTop: '8px', background: '#7367f0', color: '#fff', fontWeight: 500, padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                          Save Custom Provider
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat AI Preferences */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '24px', border: '1px solid #2a2c37' }}>
                  <h3 style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '16px' }}>
                    <MessageCircle size={18} color="#10b981" /> Chat AI Preferences
                  </h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px' }}>
                    <div>
                      <span style={{ color: '#e9edf5', fontSize: '14px', display: 'block' }}>Global Chat TTS Output</span>
                      <span style={{ color: '#a3a8b7', fontSize: '10px' }}>Applies to all new chat sessions.</span>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
                      <input type="checkbox" checked={chatTtsEnabled} onChange={(e) => setChatTtsEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: chatTtsEnabled ? '#7367f0' : '#2a2c37', transition: '.4s', borderRadius: '24px' }}>
                        <span style={{ position: 'absolute', content: '""', height: '16px', width: '16px', left: chatTtsEnabled ? '20px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Notification Behaviors */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '24px', border: '1px solid #2a2c37' }}>
                  <h3 style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '16px' }}>
                    <AlertCircle size={18} color="#f59e0b" /> Notification Preferences
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ color: '#e9edf5', fontSize: '14px', display: 'block' }}>Allow App to read notifications</span>
                      </div>
                      <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
                        <input type="checkbox" checked={appReadNotifications} onChange={(e) => setAppReadNotifications(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                        <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: appReadNotifications ? '#7367f0' : '#2a2c37', transition: '.4s', borderRadius: '24px' }}>
                          <span style={{ position: 'absolute', content: '""', height: '16px', width: '16px', left: appReadNotifications ? '20px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></span>
                        </span>
                      </label>
                    </div>

                    {appReadNotifications && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px', paddingLeft: '16px', borderLeft: '2px solid #2a2c37' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#a3a8b7', marginBottom: '8px' }}>Read notifications from:</label>
                          <select 
                            value={notificationScope} 
                            onChange={(e) => setNotificationScope(e.target.value as any)}
                            style={{ width: '100%', background: '#15161d', border: '1px solid #2a2c37', borderRadius: '8px', padding: '8px 12px', color: '#fff', outline: 'none', cursor: 'pointer' }}
                          >
                            <option value="skill_modules">Only Skill Modules</option>
                            <option value="all">All System Apps</option>
                          </select>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', color: '#a3a8b7', marginBottom: '8px' }}>How should notifications come up?</label>
                          <select 
                            value={notificationOutput} 
                            onChange={(e) => setNotificationOutput(e.target.value as any)}
                            style={{ width: '100%', background: '#15161d', border: '1px solid #2a2c37', borderRadius: '8px', padding: '8px 12px', color: '#fff', outline: 'none', cursor: 'pointer' }}
                          >
                            <option value="show_only">Show Only (Visual Toast)</option>
                            <option value="tts">Read Aloud (TTS)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* App Power Controls */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '24px', border: '1px solid #2a2c37' }}>
                  <h3 style={{ color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '16px' }}>
                    <PowerOff size={18} color="#ef4444" /> App Actions
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button onClick={() => handleAppAction('logout')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: '#2a2c37', color: '#fff', fontWeight: 500, cursor: 'pointer', border: 'none' }}>
                      <Lock size={16} /> Log Out
                    </button>
                    <button onClick={() => handleAppAction('restart')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: '#2a2c37', color: '#fff', fontWeight: 500, cursor: 'pointer', border: 'none' }}>
                      <RefreshCw size={16} /> Restart App
                    </button>
                    <button onClick={() => handleAppAction('close')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 500, cursor: 'pointer' }}>
                      <PowerOff size={16} /> Close Nexus AI
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
          
          <div style={{ padding: '16px 32px', background: '#15161d', borderTop: '1px solid #2a2c37', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => setSettingsOpen(false)} style={{ background: 'transparent', color: '#a3a8b7', border: '1px solid #2a2c37', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
              Cancel
            </button>
            <button onClick={async () => {
              // Sync notification settings to backend
              try {
                await fetch('http://127.0.0.1:8765/api/notifications/prefs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    global_notifications_enabled: appReadNotifications,
                    notification_mode: notificationScope === 'all' ? 'all_apps' : 'listed_apps_only'
                  })
                });
              } catch (e) {
                console.error('Failed to sync notification prefs', e);
              }
              toast.success('Settings Saved Successfully');
              setSettingsOpen(false);
            }} style={{ background: '#7367f0', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
