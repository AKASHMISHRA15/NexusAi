import React, { useState, useEffect } from 'react';
import { Search, Edit3, Inbox, Send, Star, FileText, Trash2, Archive, LogIn, Mail, ArrowLeft, LogOut, AlertCircle, ChevronRight } from 'lucide-react';
import { openGoogleOAuthInBrowser } from '../../lib/google-oauth';

interface Email {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  avatar: string;
  labels: string[];
}

type Folder = 'INBOX' | 'SENT' | 'STARRED' | 'DRAFT' | 'TRASH' | 'SPAM';

const FOLDER_QUERIES: Record<Folder, string> = {
  INBOX: 'in:inbox',
  SENT: 'in:sent',
  STARRED: 'is:starred',
  DRAFT: 'in:drafts',
  TRASH: 'in:trash',
  SPAM: 'in:spam',
};

const mockEmails: Email[] = [
  {
    id: 'mock1',
    sender: 'Nexus Team',
    senderEmail: 'hello@nexusai.app',
    subject: 'Welcome to your new AI workspace',
    snippet: 'We are thrilled to have you on board. Here are a few tips to get started with Nexus AI...',
    body: 'We are thrilled to have you on board!\n\nHere are a few tips to get you started:\n• Open the Chat Assistant to talk to your AI\n• Use the Voice Assistant for hands-free control\n• Connect your Gmail and Spotify accounts for real data\n\nEnjoy NexusAI!',
    date: '10:42 AM',
    isRead: false,
    isStarred: false,
    avatar: 'N',
    labels: ['INBOX'],
  }
];

export const EmailClientUI: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>(mockEmails);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [activeFolder, setActiveFolder] = useState<Folder>('INBOX');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadToken = () => {
      const _token = localStorage.getItem('gmail_token');
      if (_token) {
        setToken(_token);
        fetchEmails(_token, 'INBOX');
      }
    };

    // Load initially
    loadToken();

    // Listen for OAuth updates from App.tsx
    window.addEventListener('gmail_token_updated', loadToken);
    return () => window.removeEventListener('gmail_token_updated', loadToken);
  }, []);

  const handleConnect = async () => {
    try {
      await openGoogleOAuthInBrowser('gmail');
      // The rest of the flow is handled by App.tsx intercepting the callback 
      // and emitting the 'gmail_token_updated' event to this component.
    } catch (e) {
      console.error('Gmail connect error', e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gmail_token');
    setToken(null);
    setEmails(mockEmails);
    setSelectedEmail(null);
    setActiveFolder('INBOX');
  };

  const fetchEmails = async (accessToken: string, folder: Folder) => {
    setLoading(true);
    setSelectedEmail(null);
    setEmails([]);
    try {
      const q = encodeURIComponent(FOLDER_QUERIES[folder]);
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=${q}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('gmail_token');
        setToken(null);
        return;
      }
      const data = await res.json();

      if (!data.messages || data.messages.length === 0) {
        setEmails([]);
        setLoading(false);
        return;
      }

      const emailDetails = await Promise.all(
        data.messages.map(async (msg: any) => {
          const mRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const mData = await mRes.json();

          const headers = mData.payload.headers;
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
          const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
          const dateStr = headers.find((h: any) => h.name === 'Date')?.value || '';
          const isRead = !mData.labelIds?.includes('UNREAD');
          const isStarred = mData.labelIds?.includes('STARRED') ?? false;

          const senderMatch = from.match(/^(.*?)\s*<(.+)>$/);
          const senderName = senderMatch ? senderMatch[1].replace(/"/g, '').trim() : from;
          const senderEmail = senderMatch ? senderMatch[2] : from;

          let timeDisplay = '';
          try {
            const d = new Date(dateStr);
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            timeDisplay = isToday
              ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
          } catch { timeDisplay = dateStr.substring(0, 10); }

          return {
            id: mData.id,
            sender: senderName || senderEmail,
            senderEmail,
            subject,
            snippet: mData.snippet,
            date: timeDisplay,
            isRead,
            isStarred,
            avatar: (senderName || senderEmail).charAt(0).toUpperCase(),
            labels: mData.labelIds || [],
          };
        })
      );
      setEmails(emailDetails);
    } catch (e) {
      console.error('Fetch emails error', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailBody = async (emailId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      // Try to extract plain text body
      let body = '';
      const extractText = (parts: any[]): string => {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
          if (part.parts) {
            const result = extractText(part.parts);
            if (result) return result;
          }
        }
        return '';
      };

      if (data.payload.body?.data) {
        body = atob(data.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } else if (data.payload.parts) {
        body = extractText(data.payload.parts);
      }

      setSelectedEmail(prev => prev ? { ...prev, body } : prev);
    } catch (e) {
      console.error('Failed to fetch email body', e);
    }
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    if (!email.body && token) {
      fetchEmailBody(email.id);
    }
    // Mark as read locally
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
  };

  const handleFolderChange = (folder: Folder) => {
    setActiveFolder(folder);
    setSelectedEmail(null);
    if (token) fetchEmails(token, folder);
  };

  const filteredEmails = searchQuery
    ? emails.filter(e => e.subject.toLowerCase().includes(searchQuery.toLowerCase()) || e.sender.toLowerCase().includes(searchQuery.toLowerCase()))
    : emails;

  const unreadCount = emails.filter(e => !e.isRead).length;

  const folderItems: { key: Folder; icon: React.ReactNode; label: string }[] = [
    { key: 'INBOX', icon: <Inbox size={16} />, label: 'Inbox' },
    { key: 'STARRED', icon: <Star size={16} />, label: 'Starred' },
    { key: 'SENT', icon: <Send size={16} />, label: 'Sent' },
    { key: 'DRAFT', icon: <FileText size={16} />, label: 'Drafts' },
    { key: 'TRASH', icon: <Trash2 size={16} />, label: 'Trash' },
    { key: 'SPAM', icon: <AlertCircle size={16} />, label: 'Spam' },
  ];

  if (!token) {
    return (
      <div style={{ minHeight: '600px', flex: 1, border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(20,22,27,0.4)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#EA4335', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 8px 24px rgba(234,67,53,0.3)' }}>
          <Mail size={32} color="#fff" />
        </div>
        <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Connect to Gmail</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px', textAlign: 'center', maxWidth: '400px' }}>
          Grant NexusAI permission to view your emails so you can read and manage your inbox directly from this dashboard.
        </p>
        <button onClick={handleConnect} style={{ background: '#EA4335', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '30px', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(234,67,53,0.2)' }}>
          <LogIn size={18} />
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '600px', flex: 1, border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(20,22,27,0.4)', borderRadius: '16px', overflow: 'hidden', display: 'flex', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Left Sidebar ── */}
      <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button style={{ backgroundColor: '#7367f0', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', marginBottom: '16px', boxShadow: '0 4px 12px rgba(115,103,240,0.3)' }}>
          <Edit3 size={16} /> Compose
        </button>

        {folderItems.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => handleFolderChange(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px',
              border: 'none', background: activeFolder === key ? 'rgba(115,103,240,0.15)' : 'transparent',
              color: activeFolder === key ? '#a89eff' : 'rgba(255,255,255,0.7)',
              cursor: 'pointer', fontSize: '14px', fontWeight: activeFolder === key ? 600 : 400, textAlign: 'left', width: '100%'
            }}
          >
            {icon}
            <span style={{ flex: 1 }}>{label}</span>
            {key === 'INBOX' && unreadCount > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#7367f0', color: '#fff', padding: '1px 6px', borderRadius: '10px' }}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', width: '100%' }}>
          <LogOut size={14} /> Sign Out of Gmail
        </button>
      </div>

      {/* ── Email List ── */}
      <div style={{ width: selectedEmail ? '320px' : undefined, flex: selectedEmail ? undefined : 1, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: selectedEmail ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        {/* Search Header */}
        <div style={{ height: '64px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '10px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input type="text" placeholder="Search mail..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 10px 7px 30px', color: '#fff', fontSize: '13px', outline: 'none' }} />
          </div>
          <Archive size={16} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }} />
        </div>

        {/* Email rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading {activeFolder.toLowerCase()}...</div>
          ) : filteredEmails.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No emails found.</div>
          ) : (
            filteredEmails.map((email) => (
              <div
                key={email.id}
                onClick={() => handleSelectEmail(email)}
                style={{
                  display: 'flex', alignItems: 'flex-start', padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  backgroundColor: selectedEmail?.id === email.id
                    ? 'rgba(115,103,240,0.1)'
                    : email.isRead ? 'transparent' : 'rgba(115,103,240,0.04)',
                  cursor: 'pointer', gap: '12px', transition: 'background-color 0.15s'
                }}
              >
                <div style={{ width: '34px', height: '34px', flexShrink: 0, borderRadius: '50%', background: email.isRead ? 'rgba(255,255,255,0.08)' : '#7367f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>
                  {email.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: email.isRead ? 400 : 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{email.sender}</span>
                    <span style={{ fontSize: '11px', color: email.isRead ? 'rgba(255,255,255,0.4)' : '#a89eff', flexShrink: 0 }}>{email.date}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: email.isRead ? 400 : 600, color: email.isRead ? 'rgba(255,255,255,0.7)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                    {email.subject}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email.snippet}
                  </div>
                </div>
                <ChevronRight size={14} color="rgba(255,255,255,0.2)" style={{ flexShrink: 0, marginTop: '10px' }} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Email Detail Pane ── */}
      {selectedEmail && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Detail Header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setSelectedEmail(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.6)', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex' }}>
              <ArrowLeft size={16} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedEmail.subject}</h3>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{selectedEmail.sender} &lt;{selectedEmail.senderEmail}&gt;</span>
            </div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{selectedEmail.date}</span>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', fontSize: '14px', lineHeight: '1.7', color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {selectedEmail.body || (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                <div style={{ marginBottom: '8px' }}>{selectedEmail.snippet}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>Loading full message...</div>
              </div>
            )}
          </div>

          {/* Reply bar */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="Quick reply..." style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '10px 14px', color: '#fff', fontSize: '13px', outline: 'none' }} />
            <button style={{ background: '#7367f0', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};
