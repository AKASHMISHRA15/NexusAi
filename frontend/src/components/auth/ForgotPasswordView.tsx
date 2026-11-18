import React, { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface ForgotPasswordViewProps {
  onEmailSent: (email: string) => void;
  onNavigate: (view: 'login') => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onEmailSent, onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      await sendPasswordResetEmail(auth, email);
      onEmailSent(email);
    } catch (err: any) {
      console.error("Firebase reset password error:", err);
      // For security, it's often better not to reveal if the email exists,
      // but Firebase throws specific errors.
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else {
        setError(err.message || 'Failed to send reset email.');
      }
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
      className="auth-view-container"
    >
      <button 
        type="button" 
        onClick={() => onNavigate('login')}
        className="auth-back-btn"
      >
        <ArrowLeft size={16} /> Back to login
      </button>

      <div className="auth-header mt-4">
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">Enter the email associated with your account to receive a reset link.</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form mt-6">
        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <div className="input-with-icon">
            <Mail className="input-icon" size={18} />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
        </div>

        {error && <p className="auth-error-text">{error}</p>}

        <button type="submit" className="auth-primary-btn mt-2" disabled={loading}>
          {loading ? 'Sending link...' : 'Send Reset Link'} <ArrowRight size={16} />
        </button>
      </form>
    </motion.div>
  );
};
