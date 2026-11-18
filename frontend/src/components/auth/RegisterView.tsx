import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { openGoogleOAuthInBrowser } from '../../lib/google-oauth';
import { checkEmail, sendPasswordlessOtp } from '../../lib/auth-otp';

interface RegisterViewProps {
  onRegister: (email: string) => void;
  onNavigate: (view: 'login') => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, onNavigate }) => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'male',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.age || !formData.email || !formData.password) {
      setError('Please fill in all fields.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Check if email is already registered before sending OTP
      await checkEmail(formData.email, 'register');

      // Store pending registration data for after OTP verification
      sessionStorage.setItem('nexus_pending_name', formData.name);
      sessionStorage.setItem('nexus_pending_age', formData.age);
      sessionStorage.setItem('nexus_pending_gender', formData.gender);

      await sendPasswordlessOtp(formData.email);
      sessionStorage.setItem('nexus_otp_pending_email', formData.email);
      onRegister(formData.email);
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    // Store context so App.tsx knows this was a register attempt
    sessionStorage.setItem('nexus_google_auth_context', 'register');
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
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Join us and setup your new agent workspace</p>
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
        <span>or create account with email</span>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <div className="input-with-icon">
            <User className="input-icon" size={18} />
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="age">Age</label>
            <input
              id="age"
              type="number"
              min="13"
              max="120"
              value={formData.age}
              onChange={handleChange}
              placeholder="25"
            />
          </div>
          <div className="form-group flex-1">
            <label htmlFor="gender">Gender</label>
            <div className="input-with-icon">
              <UserCircle className="input-icon" size={18} />
              <select id="gender" value={formData.gender} onChange={handleChange} className="pl-9">
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <div className="input-with-icon">
            <Mail className="input-icon" size={18} />
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@company.com"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="password">Create Password</label>
          <div className="input-with-icon">
            <Lock className="input-icon" size={18} />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              placeholder="Min. 6 characters"
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
            <>Create Account <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <p className="auth-footer-text">
        Already have an account?{' '}
        <button type="button" className="text-link font-semibold" onClick={() => onNavigate('login')}>
          Sign in
        </button>
      </p>
    </motion.div>
  );
};
