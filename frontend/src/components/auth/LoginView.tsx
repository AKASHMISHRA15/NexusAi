import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { openGoogleOAuthInBrowser } from '../../lib/google-oauth';
import { checkEmail, sendPasswordlessOtp } from '../../lib/auth-otp';

interface LoginViewProps {
  onOtpSent: (email: string) => void;
  onNavigate: (view: 'register') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onOtpSent, onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Verify the email exists before sending OTP
      await checkEmail(email, 'login');

      await sendPasswordlessOtp(email);
      sessionStorage.setItem('nexus_otp_pending_email', email);
      onOtpSent(email);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    // Store context so App.tsx knows this was a login attempt
    sessionStorage.setItem('nexus_google_auth_context', 'login');
    try {
      await openGoogleOAuthInBrowser();
      setTimeout(() => setGoogleLoading(false), 3000);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(err.message || 'Failed to open Google sign-in.');
      setGoogleLoading(false);
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
      <div className="auth-header">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to continue to your workspace</p>
      </div>

      <button
        type="button"
        className="auth-google-btn"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        style={{ marginBottom: '16px' }}
      >
        {googleLoading ? (
          <>
            <span className="auth-spinner" />
            Redirecting to Google…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continue with Google
          </>
        )}
      </button>

      <div className="auth-divider">
        <span>or sign in with a verification code</span>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="login-email">Email address</label>
          <div className="input-with-icon">
            <Mail className="input-icon" size={18} />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <div className="input-with-icon">
            <Lock className="input-icon" size={18} />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{ paddingRight: '3rem' }}
            />
            <button
              type="button"
              className="password-eye-btn"
              onClick={() => setShowPassword(v => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="auth-error-banner">
            <span className="auth-error-dot" />
            {error}
          </div>
        )}

        <button type="submit" className="auth-primary-btn" disabled={loading}>
          {loading ? (
            <><span className="auth-spinner" /> Checking…</>
          ) : (
            <>Send Code <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <p className="auth-footer-text">
        Don't have an account?{' '}
        <button type="button" className="text-link font-semibold" onClick={() => onNavigate('register')}>
          Sign up
        </button>
      </p>
    </motion.div>
  );
};
