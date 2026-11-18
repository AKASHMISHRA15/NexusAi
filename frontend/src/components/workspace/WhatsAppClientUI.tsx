import React, { useState, useRef, useEffect } from 'react';
import { Search, Mic, Smile, Send, MoreVertical, Phone, Video, Sparkles, CheckCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  lastSeen?: string;
  unreadCount?: number;
}

const mockContacts: Contact[] = [
  { id: '1', name: 'Alice Cooper', avatar: 'https://i.pravatar.cc/150?img=1', unreadCount: 2, lastSeen: 'today at 12:30 PM' },
  { id: '2', name: 'Bob Smith', avatar: 'https://i.pravatar.cc/150?img=2', unreadCount: 0, lastSeen: 'yesterday' },
  { id: '3', name: 'Charlie Brown', avatar: 'https://i.pravatar.cc/150?img=3', unreadCount: 0, lastSeen: 'online' },
];

const initialMessages: Record<string, Message[]> = {
  '1': [
    { id: 'm1', text: 'Hey, are we still meeting today?', sender: 'them', timestamp: '10:00 AM' },
    { id: 'm2', text: 'Yes! Let\'s meet at 2.', sender: 'me', timestamp: '10:05 AM', status: 'read' },
    { id: 'm3', text: 'Awesome, see you then.', sender: 'them', timestamp: '10:06 AM' },
  ],
  '2': [
    { id: 'm4', text: 'Can you send me the report?', sender: 'them', timestamp: 'Yesterday' },
  ],
  '3': [
    { id: 'm5', text: 'Lunch?', sender: 'them', timestamp: 'Monday' },
    { id: 'm6', text: 'Sure, same place?', sender: 'me', timestamp: 'Monday', status: 'read' },
  ]
};

const aiSuggestions = [
  "Yes, sounds good!",
  "Let me check and get back to you.",
  "Can we reschedule?"
];

export const WhatsAppClientUI: React.FC = () => {
  const [selectedContactId, setSelectedContactId] = useState<string>('1');
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(initialMessages);
  const [inputValue, setInputValue] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesMap, selectedContactId]);

  const selectedContact = mockContacts.find(c => c.id === selectedContactId);
  const currentMessages = messagesMap[selectedContactId] || [];
  
  const filteredContacts = mockContacts.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };

    setMessagesMap(prev => ({
      ...prev,
      [selectedContactId]: [...(prev[selectedContactId] || []), newMessage]
    }));
    
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage(inputValue);
    }
  };

  return (
    <div style={{
      height: 'calc(100vh - 220px)',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(20,22,27,0.2)',
      borderRadius: '16px',
      overflow: 'hidden',
      display: 'flex',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#ffffff',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)'
    }}>
      {/* Left Sidebar */}
      <div style={{
        width: '260px',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(20,22,27,0.4)',
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#e5e7eb' }}>Chats</h2>
          <MoreVertical size={20} color="#9ca3af" style={{ cursor: 'pointer' }} />
        </div>

        {/* Search */}
        <div style={{ padding: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '8px 12px',
          }}>
            <Search size={16} color="#9ca3af" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e5e7eb',
                marginLeft: '8px',
                width: '100%',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {/* Contact List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredContacts.map(contact => {
            const lastMessage = messagesMap[contact.id]?.[messagesMap[contact.id].length - 1];
            const isSelected = contact.id === selectedContactId;
            return (
              <div
                key={contact.id}
                onClick={() => setSelectedContactId(contact.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'background 0.2s',
                  borderBottom: '1px solid rgba(255,255,255,0.02)'
                }}
              >
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
                <div style={{ marginLeft: '12px', flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#f3f4f6' }}>
                      {contact.name}
                    </span>
                    {lastMessage && (
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{lastMessage.timestamp}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{
                      fontSize: '13px',
                      color: '#9ca3af',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {lastMessage?.text || 'No messages yet'}
                    </span>
                    {contact.unreadCount ? (
                      <span style={{
                        background: '#10b981',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        borderRadius: '10px',
                        padding: '2px 6px',
                        marginLeft: '8px'
                      }}>
                        {contact.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      {selectedContact ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(20,22,27,0.6)' }}>
          
          {/* Chat Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(20,22,27,0.8)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <img
                src={selectedContact.avatar}
                alt={selectedContact.name}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
              <div style={{ marginLeft: '12px' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#f3f4f6' }}>
                  {selectedContact.name}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {selectedContact.lastSeen ? `Last seen ${selectedContact.lastSeen}` : 'Offline'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Video size={20} color="#9ca3af" style={{ cursor: 'pointer' }} />
              <Phone size={20} color="#9ca3af" style={{ cursor: 'pointer' }} />
              <Search size={20} color="#9ca3af" style={{ cursor: 'pointer' }} />
              <MoreVertical size={20} color="#9ca3af" style={{ cursor: 'pointer' }} />
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {currentMessages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                style={{
                  alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  background: msg.sender === 'me' ? '#10b981' : 'rgba(255,255,255,0.1)',
                  padding: '8px 12px',
                  borderRadius: msg.sender === 'me' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  color: msg.sender === 'me' ? '#ffffff' : '#e5e7eb',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{msg.text}</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '4px',
                  marginTop: '4px',
                  opacity: 0.8
                }}>
                  <span style={{ fontSize: '10px' }}>{msg.timestamp}</span>
                  {msg.sender === 'me' && (
                    <CheckCheck size={14} color={msg.status === 'read' ? '#34d399' : '#fff'} />
                  )}
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Suggestions */}
          <div style={{ padding: '0 16px', display: 'flex', gap: '8px', marginBottom: '8px', overflowX: 'auto' }}>
            {aiSuggestions.map((suggestion, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSendMessage(suggestion)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  color: '#10b981',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Sparkles size={14} />
                {suggestion}
              </motion.button>
            ))}
          </div>

          {/* Input Area */}
          <div style={{
            padding: '12px 16px',
            background: 'rgba(20,22,27,0.8)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Smile size={24} color="#9ca3af" style={{ cursor: 'pointer' }} />
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '20px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <input
                type="text"
                placeholder="Type a message"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  width: '100%',
                  fontSize: '14px'
                }}
              />
            </div>
            {inputValue.trim() ? (
              <div 
                onClick={() => handleSendMessage(inputValue)}
                style={{ 
                  background: '#10b981', 
                  borderRadius: '50%', 
                  padding: '8px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <Send size={18} color="#fff" />
              </div>
            ) : (
              <Mic size={24} color="#9ca3af" style={{ cursor: 'pointer' }} />
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#9ca3af' }}>
          Select a chat to start messaging
        </div>
      )}
    </div>
  );
};
