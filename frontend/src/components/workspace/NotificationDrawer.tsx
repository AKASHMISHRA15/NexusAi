import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Trash2, X, RefreshCcw, Archive } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';

export const NotificationDrawer: React.FC = () => {
  const { 
    notifications, 
    trashedNotifications,
    clearNotifications, 
    clearUnreadNotifications,
    deleteNotification,
    recoverNotification,
    isNotificationDrawerOpen, 
    setNotificationDrawerOpen 
  } = useAgentStore();

  const [viewMode, setViewMode] = useState<'inbox' | 'trash'>('inbox');

  useEffect(() => {
    if (isNotificationDrawerOpen) {
      clearUnreadNotifications();
    }
  }, [isNotificationDrawerOpen, clearUnreadNotifications]);

  if (!isNotificationDrawerOpen) return null;

  const currentList = viewMode === 'inbox' ? notifications : trashedNotifications;

  return (
    <>
      <button className="notification-scrim" aria-label="Close notifications" onClick={() => setNotificationDrawerOpen(false)} />
      <aside className="notification-drawer">
        <header>
          <div>
            <h2>{viewMode === 'inbox' ? 'Notifications' : 'Trash'}</h2>
            <span>{currentList.length}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {viewMode === 'inbox' ? (
              <>
                <button onClick={() => setViewMode('trash')} title="View Trash" style={{ position: 'relative' }}>
                  <Archive size={17} />
                  {trashedNotifications.length > 0 && (
                    <span style={{ position: 'absolute', top: -5, right: -5, background: '#ed586e', color: 'white', borderRadius: '50%', fontSize: '9px', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {trashedNotifications.length}
                    </span>
                  )}
                </button>
                <button onClick={clearNotifications} title="Clear all to trash"><Trash2 size={17}/></button>
              </>
            ) : (
              <button onClick={() => setViewMode('inbox')} title="Back to Inbox"><Bell size={17}/></button>
            )}
            <button onClick={() => setNotificationDrawerOpen(false)} title="Close"><X size={18}/></button>
          </div>
        </header>
        <div className="notification-drawer-list">
          {currentList.length ? currentList.map(item => (
            <article key={item.id} style={{ position: 'relative' }}>
              <CheckCircle2/>
              <div style={{ flex: 1, paddingRight: '24px' }}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <small>{new Date(item.timestamp).toLocaleTimeString()}</small>
              </div>
              <div style={{ position: 'absolute', right: '12px', top: '12px' }}>
                {viewMode === 'inbox' ? (
                  <button onClick={() => deleteNotification(item.id)} title="Delete" style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                ) : (
                  <button onClick={() => recoverNotification(item.id)} title="Recover" style={{ background: 'transparent', border: 'none', color: '#38d486', cursor: 'pointer' }}>
                    <RefreshCcw size={16} />
                  </button>
                )}
              </div>
            </article>
          )) : (
            <div className="notification-empty">
              {viewMode === 'inbox' ? <Bell size={26}/> : <Archive size={26} />}
              <strong>{viewMode === 'inbox' ? 'No notifications yet' : 'Trash is empty'}</strong>
              {viewMode === 'inbox' && <p>App notifications will appear here when “Show notification” is selected in Settings.</p>}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
