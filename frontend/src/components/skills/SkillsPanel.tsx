import React, { useEffect, useState } from 'react';
import {
  Terminal, Globe, LayoutGrid, Printer, MessageCircle, Presentation,
  FileText, Calendar, Loader2, Folder, XCircle, BookOpen, Mail,
  Users, Camera, Box, Settings, Table, Calculator, Clock, Send,
  Video, PlayCircle, Image as ImageIcon, Music, Compass, Bell, BellOff,
  Scan, Plus, Play, Layers, AppWindow, Search, Trash2, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useAgentStore } from '../../stores/agentStore';

const iconMap: Record<string, React.ReactNode> = {
  terminal: <Terminal size={20} />, globe: <Globe size={20} />, 'layout-grid': <LayoutGrid size={20} />,
  printer: <Printer size={20} />, 'message-circle': <MessageCircle size={20} />, presentation: <Presentation size={20} />,
  'file-text': <FileText size={20} />, calendar: <Calendar size={20} />, folder: <Folder size={20} />,
  'x-circle': <XCircle size={20} />, 'book-open': <BookOpen size={20} />, mail: <Mail size={20} />,
  users: <Users size={20} />, camera: <Camera size={20} />, settings: <Settings size={20} />,
  table: <Table size={20} />, calculator: <Calculator size={20} />, clock: <Clock size={20} />,
  send: <Send size={20} />, video: <Video size={20} />, 'play-circle': <PlayCircle size={20} />,
  image: <ImageIcon size={20} />, music: <Music size={20} />, compass: <Compass size={20} />
};

interface Skill {
  id: string; name: string; description: string; icon: string; status: 'active' | 'coming_soon';
  category: string; enabled?: boolean; notification_keys?: string[];
}

interface NativeApp {
  name: string;
  path: string;
  category?: string;
}

const DETECTED_APPS_KEY = 'skill_module_detected_apps_v1';
const BOARD_INITIALIZED_KEY = 'skill_module_board_initialized_v1';
const UNPINNED_APPS_KEY = 'skill_module_unpinned_apps_v1';

const readDetectedApps = (): NativeApp[] => {
  try {
    return JSON.parse(localStorage.getItem(DETECTED_APPS_KEY) || '[]');
  } catch {
    return [];
  }
};

const readUnpinnedPaths = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(UNPINNED_APPS_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

const writeUnpinnedPaths = (paths: Set<string>) => {
  localStorage.setItem(UNPINNED_APPS_KEY, JSON.stringify([...paths]));
};

export const SkillsPanel: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [nexusFilter, setNexusFilter] = useState('');
  const [notifAppPrefs, setNotifAppPrefs] = useState<Record<string, boolean>>({});
  const { nativeApps, setNativeApps } = useAgentStore();
  const [nativeFilter, setNativeFilter] = useState('');
  const [nativeCatFilter, setNativeCatFilter] = useState('All');
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'nexus' | 'installed'>('nexus');
  const [hasScanned, setHasScanned] = useState(localStorage.getItem('appsScanned') === 'true');
  const [isScanning, setIsScanning] = useState(false);
  const [detectedApps, setDetectedApps] = useState<NativeApp[]>(readDetectedApps);
  const [isAppPickerOpen, setIsAppPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const processApps = (apps: any[]) => apps.map(a => {
    const name = (a.name || '').toLowerCase();
    // UWP apps already have category set
    let cat = (a.category && a.category !== "Desktop App") ? a.category : 'Other';

    // Browser
    if (name.match(/chrome|edge|brave|firefox|opera|vivaldi|tor browser|waterfox|librewolf/)) cat = 'Browser';
    // Communication
    else if (name.match(/whatsapp|discord|slack|teams|zoom|telegram|signal|skype|viber|messenger|meet|webex|wire/)) cat = 'Communication';
    // Media & Entertainment
    else if (name.match(/spotify|vlc|winamp|foobar|aimp|mpc-hc|kodi|plex|jellyfin|netflix|youtube|obs|lightworks|davinci|premiere|aftereffects|audacity|fl studio|ableton|rekordbox|itunes|windows media|media player|musicbee|dopamine|clementine|popcorn|stremio|mpv|player|media|music|video|audio|photo|image|gimp|paint|pixelmator|acrobat|adobe|snapseed|darktable|rawtherapee|handbrake|makemkv|winx|anyvideoconverter|sharex|bandicam|fraps|camtasia|greenshot|irfanview|xnview|infuse|iina/)) cat = 'Media';
    // Productivity
    else if (name.match(/excel|word|powerpoint|onenote|outlook|access|publisher|project|visio|office|libreoffice|openoffice|wps office|notion|obsidian|logseq|anytype|roam|typora|marktext|focuswriter|scrivener|calibre|zotero|mendeley|endnote|pdf|foxit|sumatrapdf|drawio|lucidchart|figma|sketch|xd|affinity|canva|miro|trello|asana|todoist|things|omnifocus|ticktick|2do|be focused|forest|toggl|clockify|harvest|rescuetime|fantastical|calendar|notepad|sticky/)) cat = 'Productivity';
    // Development
    else if (name.match(/visual studio|vscode|code|intellij|pycharm|webstorm|phpstorm|rider|clion|goland|datagrip|android studio|xcode|eclipse|netbeans|sublime|atom|notepad\+\+|emacs|neovim|vim|terminal|powershell|git|github desktop|sourcetree|gitkraken|fork|tower|sequel pro|tableplus|datagrip|mongodb compass|robo 3t|redis|postman|insomnia|hoppscotch|docker|virtualbox|vmware|wsl|putty|winscp|filezilla|cyberduck|transmit|mobaxterm|windows subsystem|lm studio|ollama|jan ai|gpt4all|cursor|windsurf/)) cat = 'Development';
    // Gaming
    else if (name.match(/steam|epic games|gog|origin|ea app|battle\.net|ubisoft|rockstar|minecraft|roblox|valorant|league|fortnite|apex|overwatch|warzone|elden ring|cyberpunk|unity hub|unreal|godot|game|gaming/)) cat = 'Gaming';
    // System & Utility
    else if (name.match(/antivirus|malwarebytes|avast|bitdefender|kaspersky|norton|mcafee|eset|trend micro|ccleaner|driver|backup|acronis|macrium|veracrypt|bitwarden|1password|lastpass|dashlane|keepass|vpn|nordvpn|expressvpn|protonvpn|surfshark|teamviewer|anydesk|remote|cpu-z|gpu-z|hwinfo|speccy|hwmonitor|aida64|msi afterburner|rainmeter|equalizer|autohotkey|powertoys|everything|listary|launchy|ultramon|displayfusion|f.lux|nightlight|winrar|7-zip|peazip|winzip|cleanmypc|optimizer|cleaner/)) cat = 'Utility';

    return { name: a.name, path: a.path, category: cat };
  });

  useEffect(() => {
    Promise.all([
      fetch('http://127.0.0.1:8765/api/skills').then(res => res.json()),
      fetch('http://127.0.0.1:8765/api/notifications/prefs').then(res => res.json()).catch(() => ({}))
    ]).then(([skillsData, notifData]) => {
      setSkills(skillsData.skills || []);
      setNotifAppPrefs(notifData.app_preferences || {});
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    if (hasScanned && detectedApps.length === 0) {
      invoke<any[]>('scan_apps').then(apps => {
        const cleanApps = processApps(apps);
        setDetectedApps(cleanApps);
        localStorage.setItem(DETECTED_APPS_KEY, JSON.stringify(cleanApps));
      }).catch(e => console.error('Failed to scan apps', e));
    }
  }, []);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const apps = await invoke<any[]>('scan_apps');
      const cleanApps = processApps(apps);
      setDetectedApps(cleanApps);
      localStorage.setItem(DETECTED_APPS_KEY, JSON.stringify(cleanApps));
      // Populate a new board from the first clean scan. Future rescans refresh
      // the picker only, so an app a user removed is never silently re-pinned.
      if (localStorage.getItem(BOARD_INITIALIZED_KEY) !== 'true') {
        const unpinned = readUnpinnedPaths();
        setNativeApps(cleanApps.filter(app => !unpinned.has(app.path.toLowerCase())));
        localStorage.setItem(BOARD_INITIALIZED_KEY, 'true');
      }
      localStorage.setItem('appsScanned', 'true');
      setTimeout(() => {
        setHasScanned(true);
        setIsScanning(false);
      }, 2000); // Artificial delay for beautiful animation
    } catch (e) {
      toast.error('Failed to scan for apps');
      setIsScanning(false);
    }
  };

  const handleAddSelectedApps = () => {
    const appsToAdd = detectedApps.filter(app => selectedPaths.has(app.path));
    const merged = [...nativeApps];
    appsToAdd.forEach(app => {
      if (!merged.some(existing => existing.path.toLowerCase() === app.path.toLowerCase())) merged.push(app);
    });
    setNativeApps(merged);
    const unpinned = readUnpinnedPaths();
    appsToAdd.forEach(app => unpinned.delete(app.path.toLowerCase()));
    writeUnpinnedPaths(unpinned);
    localStorage.setItem(BOARD_INITIALIZED_KEY, 'true');
    setSelectedPaths(new Set());
    setIsAppPickerOpen(false);
    toast.success(`${appsToAdd.length} app${appsToAdd.length === 1 ? '' : 's'} added to your board.`);
  };

  const handleBrowseForApp = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Applications', extensions: ['exe'] }],
    });
    if (!selected || Array.isArray(selected)) return;
    const path = selected;
    const name = path.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || 'Custom App';
    const app: NativeApp = { name, path, category: 'Other' };
    setDetectedApps(prev => {
      const next = prev.some(item => item.path.toLowerCase() === path.toLowerCase()) ? prev : [app, ...prev];
      localStorage.setItem(DETECTED_APPS_KEY, JSON.stringify(next));
      return next;
    });
    setNativeApps([...nativeApps.filter(item => item.path.toLowerCase() !== path.toLowerCase()), app]);
    const unpinned = readUnpinnedPaths();
    unpinned.delete(path.toLowerCase());
    writeUnpinnedPaths(unpinned);
    localStorage.setItem(BOARD_INITIALIZED_KEY, 'true');
    toast.success(`${name} added to your board.`);
  };

  const handleUnpinApp = (app: NativeApp) => {
    setNativeApps(nativeApps.filter(item => item.path !== app.path));
    const unpinned = readUnpinnedPaths();
    unpinned.add(app.path.toLowerCase());
    writeUnpinnedPaths(unpinned);
    localStorage.setItem(BOARD_INITIALIZED_KEY, 'true');
    toast.success(`${app.name} removed from your board.`);
  };

  const handleToggle = async (skillId: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, enabled: newEnabled } : s));

    try {
      const res = await fetch(`http://127.0.0.1:8765/api/skills/${skillId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled })
      });
      if (!res.ok) throw new Error(`Toggle failed with ${res.status}`);
    } catch (err) {
      toast.error('Could not update skill toggle');
      setSkills(prev => prev.map(s => s.id === skillId ? { ...s, enabled: currentEnabled } : s));
    }
  };

  const getNotificationKeys = (skill: Skill) => skill.notification_keys?.length ? skill.notification_keys : [skill.name.toLowerCase().replace(' desktop', '')];
  const isNotificationEnabled = (skill: Skill) => getNotificationKeys(skill).some(key => notifAppPrefs[key] !== false);

  const handleNotifToggle = async (skill: Skill, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    const updates = Object.fromEntries(getNotificationKeys(skill).map(key => [key, newEnabled]));
    setNotifAppPrefs(prev => ({ ...prev, ...updates }));

    try {
      const res = await fetch('http://127.0.0.1:8765/api/notifications/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_preferences: updates })
      });
      if (!res.ok) throw new Error(`Notification toggle failed with ${res.status}`);
    } catch (err) {
      toast.error('Could not update notification toggle');
      const reverted = Object.fromEntries(getNotificationKeys(skill).map(key => [key, currentEnabled]));
      setNotifAppPrefs(prev => ({ ...prev, ...reverted }));
    }
  };

  const categories = ['All', ...Array.from(new Set(skills.map(s => s.category)))];
  const filteredSkills = skills.filter(s => {
    const matchesCategory = filter === 'All' || s.category === filter;
    const matchesSearch = s.name.toLowerCase().includes(nexusFilter.toLowerCase()) || s.description.toLowerCase().includes(nexusFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="skills-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Header & Tabs */}
      <div style={{ padding: '32px 32px 0 32px', flexShrink: 0 }}>
        <h1 className="skills-title">Skill Modules</h1>
        <p className="skills-subtitle" style={{ marginBottom: '24px' }}>
          Equip NexusAI with capabilities to control your device, interact with apps, and streamline your workflow.
        </p>

        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #2a2c37', paddingBottom: '16px' }}>
          <button 
            onClick={() => setActiveTab('nexus')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', border: 'none', background: activeTab === 'nexus' ? '#7367f0' : 'rgba(255,255,255,0.05)', color: activeTab === 'nexus' ? '#fff' : '#a3a8b7', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            <Layers size={18} />
            Nexus Core Skills
          </button>
          <button 
            onClick={() => setActiveTab('installed')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', border: 'none', background: activeTab === 'installed' ? '#10b981' : 'rgba(255,255,255,0.05)', color: activeTab === 'installed' ? '#fff' : '#a3a8b7', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            <AppWindow size={18} />
            Installed Native Apps
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 48px 32px' }}>
        
        {/* TAB 1: NEXUS SKILLS */}
        {activeTab === 'nexus' && (
          <>
            <div className="skills-stats">
              <div className="skills-stat">
                <div className="skills-stat-number">{skills.length || '-'}</div>
                <div className="skills-stat-label">Total Skills</div>
              </div>
              {isSearchDrawerOpen ? (
                <div className="skills-stat" style={{ padding: 0, overflow: 'hidden', border: '1px solid #10b981' }}>
                  <div className="relative w-full h-full flex items-center" style={{ minHeight: '80px' }}>
                    <Search className="absolute left-6 text-[#10b981]" size={22} />
                    <input type="text" placeholder="Search skills..." value={nexusFilter} onChange={e => setNexusFilter(e.target.value)}
                      className="w-full pl-14 pr-12 bg-transparent text-white outline-none placeholder:text-[#a3a8b7] text-base font-medium"
                      style={{ height: '80px' }}
                      autoFocus />
                    <button onClick={() => { setIsSearchDrawerOpen(false); setNexusFilter(''); }} className="absolute right-4 text-[#a3a8b7] hover:text-white transition-colors">
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="skills-stat cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => setIsSearchDrawerOpen(true)}>
                  <div className="skills-stat-number text-[#10b981] group-hover:scale-110 transition-transform flex justify-center"><Search size={28} /></div>
                  <div className="skills-stat-label">Click to Search</div>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin text-[#7367f0]" size={32} />
              </div>
            ) : (
              <>
                <div className="skills-filters flex flex-wrap gap-2 mb-6">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      className={`filter-chip px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === cat ? 'bg-white text-black shadow-glow' : 'glass hover:bg-white/10 text-text-secondary hover:text-white'}`}
                      onClick={() => setFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="skills-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
                  {filteredSkills.map(skill => {
                    const skillEnabled = skill.enabled !== false;
                    const notificationsEnabled = isNotificationEnabled(skill);

                    return (
                      <div key={skill.id} className={`skill-card glass rounded-2xl p-5 flex flex-col group hover:-translate-y-1 hover:shadow-glow hover:border-accent-primary/50 ${skill.status === 'coming_soon' || !skillEnabled ? 'opacity-50 grayscale transition-all' : 'transition-all'}`}>
                        <div className="flex justify-between items-start w-full mb-4">
                          <div className="skill-card-icon w-12 h-12 rounded-xl bg-gradient-to-tr from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center text-accent-primary group-hover:scale-110 transition-transform">
                            {iconMap[skill.icon] || <Box size={24} />}
                          </div>

                          {skill.status === 'active' ? (
                            <div style={{ width: 24, height: 24 }} />
                          ) : (
                            <div className="skill-badge coming_soon text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md bg-white/10 text-white/50">Soon</div>
                          )}
                        </div>

                        <h3 className="skill-card-name text-lg font-semibold text-white mb-2">{skill.name}</h3>
                        <p className="skill-card-desc text-sm text-text-secondary leading-relaxed flex-1">{skill.description}</p>

                        {skill.status === 'active' && (
                          <div className="skill-card-footer mt-5 pt-4 border-t border-white/5 flex gap-2">
                            <button
                              type="button"
                              className={`skill-toggle-btn skill-alert-toggle ${notificationsEnabled ? 'skill-alert-on' : 'skill-alert-off'}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleNotifToggle(skill, notificationsEnabled);
                              }}
                              title="Read notifications from this app"
                            >
                              {notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                              {notificationsEnabled ? 'Alerts ON' : 'Alerts OFF'}
                            </button>

                            <button
                              type="button"
                              className={`skill-toggle-btn skill-state-toggle ${skillEnabled ? 'skill-enabled' : 'skill-disabled'}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleToggle(skill.id, skillEnabled);
                              }}
                              title="Enable/disable skill"
                            >
                              <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${skillEnabled ? 'bg-green-400' : 'bg-red-400'}`} />
                              {skillEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* TAB 2: INSTALLED APPS */}
        {activeTab === 'installed' && (
          <div className="installed-apps-section">
            <div className="skills-stats mb-8">
              <div className="skills-stat">
                <div className="skills-stat-number">{nativeApps.length || '-'}</div>
                <div className="skills-stat-label">Indexed Apps</div>
              </div>
              <div className="skills-stat cursor-pointer group hover:bg-white/5 transition-colors" onClick={handleScan}>
                <div className="skills-stat-number accent group-hover:scale-110 transition-transform">{nativeApps.length > 0 ? 'Active' : 'Standby'}</div>
                <div className="skills-stat-label">Click to Rescan</div>
              </div>
              {isSearchDrawerOpen ? (
                <div className="skills-stat" style={{ padding: 0, overflow: 'hidden', border: '1px solid #10b981' }}>
                  <div className="relative w-full h-full flex items-center" style={{ minHeight: '80px' }}>
                    <Search className="absolute left-6 text-[#10b981]" size={22} />
                    <input type="text" placeholder="Search apps..." value={nativeFilter} onChange={e => setNativeFilter(e.target.value)}
                      className="w-full pl-14 pr-12 bg-transparent text-white outline-none placeholder:text-[#a3a8b7] text-base font-medium"
                      style={{ height: '80px' }}
                      autoFocus />
                    <button onClick={() => { setIsSearchDrawerOpen(false); setNativeFilter(''); }} className="absolute right-4 text-[#a3a8b7] hover:text-white transition-colors">
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="skills-stat cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => setIsSearchDrawerOpen(true)}>
                  <div className="skills-stat-number text-[#10b981] group-hover:scale-110 transition-transform flex justify-center"><Search size={28} /></div>
                  <div className="skills-stat-label">Click to Search</div>
                </div>
              )}
            </div>

            {!hasScanned && !isScanning ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed rounded-3xl" style={{ borderColor: '#2a2c37', backgroundColor: '#0f1016' }}>
                <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', boxShadow: '0 0 30px rgba(16,185,129,0.2)' }}>
                  <Scan size={48} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Discover Installed Applications</h2>
                <p className="max-w-md mb-8" style={{ color: '#a3a8b7' }}>
                  Scan your device to automatically index all installed native apps. Once indexed, Nexus AI can seamlessly launch them for you.
                </p>
                <button onClick={handleScan} className="flex items-center gap-2 px-8 py-4 text-white rounded-xl font-bold text-lg transition-all hover:scale-105" style={{ backgroundColor: '#10b981', boxShadow: '0 0 20px rgba(16,185,129,0.4)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#059669'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#10b981'}>
                  <Scan size={20} /> Start Device Scan
                </button>
                <p className="text-xs mt-6" style={{ color: '#a3a8b7' }}>This happens entirely locally on your device. Only needs to be done once.</p>
              </div>
            ) : isScanning ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center border rounded-3xl relative overflow-hidden" style={{ borderColor: '#2a2c37', backgroundColor: '#0f1016' }}>
                <div className="absolute inset-0" style={{ backgroundColor: 'rgba(16,185,129,0.05)' }}></div>
                {/* Scanner Animation Line */}
                <div className="absolute top-0 left-0 w-full h-[2px] animate-scan" style={{ backgroundColor: '#10b981', boxShadow: '0 0 15px #10b981' }}></div>
                <div className="w-24 h-24 rounded-full border-4 animate-spin flex items-center justify-center mb-6" style={{ borderColor: 'rgba(16,185,129,0.3)', borderTopColor: '#10b981', boxShadow: '0 0 30px rgba(16,185,129,0.2)' }}></div>
                <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">Scanning File System...</h2>
                <p style={{ color: '#a3a8b7' }}>Locating executables and native applications</p>
              </div>
            ) : (
              <>
                <div className="skills-filters flex flex-wrap gap-2 mb-6">
                  {['All', 'Browser', 'Communication', 'Productivity', 'Development', 'Media', 'Gaming', 'Utility', 'UWP App', 'Other'].filter(cat =>
                    cat === 'All' || nativeApps.some(a => a.category === cat)
                  ).map(cat => (
                    <button
                      key={cat}
                      className={`filter-chip px-4 py-1.5 rounded-full text-sm font-medium transition-all ${nativeCatFilter === cat ? 'bg-white text-black shadow-glow' : 'glass hover:bg-white/10 text-text-secondary hover:text-white'}`}
                      onClick={() => setNativeCatFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="skills-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-12">
                  {/* Add App Card */}
                  <div onClick={() => setIsAppPickerOpen(true)} className="skill-card glass rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer group transition-all" style={{ borderStyle: 'dashed', minHeight: '220px' }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform mb-4" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                      <Plus size={32} />
                    </div>
                    <h3 className="skill-card-name text-lg font-semibold text-white mb-1">Add Applications</h3>
                    <p className="skill-card-desc text-sm text-center" style={{ color: '#a3a8b7' }}>Choose detected apps or browse for an .exe</p>
                  </div>

                  {nativeApps.filter(a => {
                    const matchesCategory = nativeCatFilter === 'All' || a.category === nativeCatFilter;
                    const matchesSearch = a.name.toLowerCase().includes(nativeFilter.toLowerCase());
                    return matchesCategory && matchesSearch;
                  }).map(app => {
                    // Generate colors
                    const colors = [
                      { bg: 'from-blue-500/20 to-purple-500/20', text: 'text-blue-400', border: 'group-hover:border-blue-500/50' },
                      { bg: 'from-emerald-500/20 to-teal-500/20', text: 'text-emerald-400', border: 'group-hover:border-emerald-500/50' },
                      { bg: 'from-orange-500/20 to-red-500/20', text: 'text-orange-400', border: 'group-hover:border-orange-500/50' },
                      { bg: 'from-pink-500/20 to-rose-500/20', text: 'text-pink-400', border: 'group-hover:border-pink-500/50' },
                      { bg: 'from-teal-500/20 to-cyan-500/20', text: 'text-teal-400', border: 'group-hover:border-teal-500/50' }
                    ];
                    const color = colors[app.name.length % colors.length];

                    return (
                      <div key={app.path} className={`skill-card glass rounded-2xl p-5 flex flex-col relative group hover:-translate-y-1 transition-all ${color.border}`}>
                        <div className="flex justify-between items-start w-full mb-4">
                          <div className={`skill-card-icon w-14 h-14 rounded-xl bg-gradient-to-tr ${color.bg} flex items-center justify-center ${color.text} group-hover:scale-110 transition-transform text-2xl font-bold`}>
                            {app.name.charAt(0).toUpperCase()}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnpinApp(app)}
                            title={`Remove ${app.name} from this board`}
                            className="absolute top-4 right-4 p-2 rounded-lg text-red-400 bg-red-500/10 border border-red-500/25 hover:text-red-200 hover:bg-red-500/25 hover:border-red-400/60 transition-colors"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <h3 className="skill-card-name text-lg font-semibold text-white mb-1 truncate" title={app.name}>{app.name}</h3>
                        <p className="skill-card-desc text-xs truncate mb-3" style={{ color: '#a3a8b7' }} title={app.path}>{app.path}</p>
                        
                        <div className="skill-card-footer mt-auto pt-4 flex">
                          <button
                            onClick={() => shellOpen(app.path).catch(() => toast.error('Failed to open app'))}
                            className="skill-toggle-btn w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors"
                            style={{ backgroundColor: '#15161d', color: 'white', border: 'none' }}
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = 'black'; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#15161d'; e.currentTarget.style.color = 'white'; }}
                          >
                            <Play size={16} /> Launch App
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {isAppPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add applications"
          onClick={() => setIsAppPickerOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.66)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={event => event.stopPropagation()} className="glass" style={{ width: 'min(720px, 100%)', maxHeight: '80vh', borderRadius: 18, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, background: '#161821', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 20 }}>Add applications</h2>
                <p style={{ margin: '4px 0 0', color: '#a3a8b7', fontSize: 13 }}>Select clean, detected apps to pin to your Skill Module board.</p>
              </div>
              <button onClick={() => setIsAppPickerOpen(false)} title="Close" className="p-2 text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 11, top: 11, color: '#a3a8b7' }} />
                <input autoFocus value={pickerSearch} onChange={event => setPickerSearch(event.target.value)} placeholder="Search detected applications..." style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 34px', borderRadius: 9, border: '1px solid #343743', background: '#0f1016', color: '#fff', outline: 'none' }} />
              </label>
              <button onClick={handleBrowseForApp} className="skill-toggle-btn" style={{ padding: '0 14px', whiteSpace: 'nowrap' }}>Browse .exe</button>
            </div>
            <div style={{ overflowY: 'auto', minHeight: 180, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
              {detectedApps.filter(app => app.name.toLowerCase().includes(pickerSearch.toLowerCase())).map(app => {
                const isSelected = selectedPaths.has(app.path);
                const isPinned = nativeApps.some(item => item.path === app.path);
                return <button key={app.path} type="button" disabled={isPinned} onClick={() => setSelectedPaths(prev => {
                  const next = new Set(prev);
                  if (next.has(app.path)) next.delete(app.path); else next.add(app.path);
                  return next;
                })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 14px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', background: isSelected ? 'rgba(16,185,129,0.13)' : 'transparent', color: isPinned ? '#6d7280' : '#fff', cursor: isPinned ? 'default' : 'pointer' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${isSelected ? '#10b981' : '#5b6070'}`, background: isSelected ? '#10b981' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{isSelected && <Check size={14} color="#07130f" />}</span>
                  <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: 14 }}>{app.name}</strong><small style={{ display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#a3a8b7' }}>{app.path}</small></span>
                  {isPinned && <span style={{ fontSize: 12, color: '#10b981' }}>Pinned</span>}
                </button>;
              })}
              {detectedApps.length === 0 && <p style={{ color: '#a3a8b7', textAlign: 'center', padding: 24 }}>Run a device scan first to see clean applications here.</p>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setIsAppPickerOpen(false)} className="skill-toggle-btn" style={{ padding: '9px 16px' }}>Cancel</button>
              <button onClick={handleAddSelectedApps} disabled={selectedPaths.size === 0} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: selectedPaths.size ? '#10b981' : '#3b3f4a', color: selectedPaths.size ? '#062717' : '#8d93a3', fontWeight: 700, cursor: selectedPaths.size ? 'pointer' : 'not-allowed' }}>Add selected ({selectedPaths.size})</button>
            </div>
          </div>
        </div>
      )}

      {/* Add CSS for the scanner animation directly in the component style tag */}
      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
};
