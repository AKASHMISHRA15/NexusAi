import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAgentStore } from '../../stores/agentStore';
import { LoginView } from './LoginView';
import { RegisterView } from './RegisterView';
import { ForgotPasswordView } from './ForgotPasswordView';
import { LinkVerificationView } from './LinkVerificationView';
import { GoogleNamePromptView } from './GoogleNamePromptView';
import './auth.css';

type AuthState = 'login' | 'register' | 'forgot_password' | 'link_verification' | 'google_name';
type OtpContext = 'login' | 'register' | 'forgot_password';

export const AuthPage: React.FC = () => {
  const { setAuthenticated, setAppScreen } = useAgentStore();
  const [currentView, setCurrentView] = useState<AuthState>('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [authContext, setAuthContext] = useState<OtpContext>('register');

  const handleNavigate = (view: AuthState) => setCurrentView(view);

  useEffect(() => {
    const showPendingOtp = () => {
      const email = sessionStorage.getItem('nexus_otp_pending_email');
      if (email) {
        sessionStorage.removeItem('nexus_otp_pending_email');
        handleOtpSent(email, 'login');
      }
    };
    const showGoogleNamePrompt = () => {
      const isNew = sessionStorage.getItem('nexus_google_new_user');
      if (isNew) {
        sessionStorage.removeItem('nexus_google_new_user');
        setCurrentView('google_name');
      }
    };
    showPendingOtp();
    showGoogleNamePrompt();
    window.addEventListener('nexus_otp_pending', showPendingOtp);
    window.addEventListener('nexus_google_new_user', showGoogleNamePrompt);
    return () => {
      window.removeEventListener('nexus_otp_pending', showPendingOtp);
      window.removeEventListener('nexus_google_new_user', showGoogleNamePrompt);
    };
  }, []);


  const handleLoginSuccess = (_email: string, _name: string) => {
    setAuthenticated(true);
    setAppScreen('landing');
  };
  const handleOtpSent = (email: string, context?: OtpContext) => {
    setPendingEmail(email);
    setAuthContext(context || 'login');
    setCurrentView('link_verification');
  };

  const handleForgotPasswordSubmit = (email: string) => {
    setPendingEmail(email);
    setAuthContext('forgot_password');
    setCurrentView('link_verification');
  };

  const handleGoogleNameSubmit = (_name: string) => {
    setAuthenticated(true);
    setAppScreen('landing');
  };

  return (
    <div className="auth-page auth-modern-bg">
      <div className="auth-card-modern glass-heavy">
        <div className="auth-brand-center">
          <div className="auth-logo-glow">N</div>
          <span className="auth-brand-text">NEXUS AI</span>
        </div>

        {(currentView === 'login' || currentView === 'register') && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => handleNavigate('login')}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', background: currentView === 'login' ? 'rgba(255,255,255,0.1)' : 'transparent', color: currentView === 'login' ? '#fff' : '#888' }}
            >
              Sign In
            </button>
            <button
              onClick={() => handleNavigate('register')}
              style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', background: currentView === 'register' ? 'rgba(255,255,255,0.1)' : 'transparent', color: currentView === 'register' ? '#fff' : '#888' }}
            >
              Create Account
            </button>
          </div>
        )}

        <div className="auth-view-wrapper">
          <AnimatePresence mode="wait">
            {currentView === 'login' && (
              <LoginView key="login" onOtpSent={handleOtpSent} onNavigate={handleNavigate} />
            )}
            {currentView === 'register' && (
              <RegisterView key="register" onRegister={(email) => handleOtpSent(email, 'register')} onNavigate={handleNavigate} />
            )}
            {currentView === 'forgot_password' && (
              <ForgotPasswordView key="forgot" onEmailSent={handleForgotPasswordSubmit} onNavigate={handleNavigate} />
            )}
            {currentView === 'link_verification' && (
              <LinkVerificationView
                key="link"
                email={pendingEmail}
                context={authContext}
                onNavigate={handleNavigate}
                onVerified={handleLoginSuccess}
              />
            )}
            {currentView === 'google_name' && (
              <GoogleNamePromptView key="google" onComplete={handleGoogleNameSubmit} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
