import React, { useState } from 'react';
import { User, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface GoogleNamePromptViewProps {
  onComplete: (name: string) => void;
}

export const GoogleNamePromptView: React.FC<GoogleNamePromptViewProps> = ({ onComplete }) => {
  // Pre-fill with Google display name if available
  const [name, setName] = useState(auth.currentUser?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your display name.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Persist the display name to Firebase
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: trimmed });
      }
      onComplete(trimmed);
    } catch (err: any) {
      setError(err.message || 'Failed to save your name. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="auth-view-container text-center"
    >
      {/* Animated celebration icon */}
      <div className="auth-header-center">
        <motion.div
          className="auth-icon-circle mx-auto mb-4"
          style={{
            background: 'linear-gradient(135deg, #7367f0, #00cfe8)',
            boxShadow: '0 8px 32px rgba(115, 103, 240, 0.4)',
            width: 72,
            height: 72,
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles size={28} className="text-white" />
        </motion.div>

        <h1 className="auth-title">One last step!</h1>
        <p className="auth-subtitle" style={{ marginTop: '0.5rem' }}>
          Your Google account is connected. <br />
          What should we call you on your dashboard?
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: '2rem' }}>
        <div className="form-group text-left">
          <label htmlFor="google-display-name">Display Name</label>
          <div className="input-with-icon">
            <User className="input-icon" size={18} />
            <input
              id="google-display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should we address you?"
              autoFocus
            />
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            This is the name you'll see on your dashboard and in conversations.
          </p>
        </div>

        {error && (
          <div className="auth-error-banner">
            <span className="auth-error-dot" />
            {error}
          </div>
        )}

        <button type="submit" className="auth-primary-btn" style={{ marginTop: '0.5rem' }} disabled={loading}>
          {loading ? (
            <><span className="auth-spinner" /> Saving…</>
          ) : (
            <>Complete Setup <ArrowRight size={16} /></>
          )}
        </button>
      </form>
    </motion.div>
  );
};
