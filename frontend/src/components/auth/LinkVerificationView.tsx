import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithCustomToken, updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { verifyPasswordlessOtp, sendPasswordlessOtp } from '../../lib/auth-otp';

interface LinkVerificationViewProps {
  email: string;
  context: 'login' | 'register' | 'forgot_password';
  onNavigate: (view: 'login' | 'register') => void;
  onVerified: (email: string, name: string) => void;
}

const OTP_LENGTH = 6;
const TIMER_SECONDS = 300; // 5 minutes

export const LinkVerificationView: React.FC<LinkVerificationViewProps> = ({
  email,
  context,
  onNavigate,
  onVerified,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [expired, setExpired] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isOtpFlow = context !== 'forgot_password';
  const otp = digits.join('');
  const isComplete = otp.length === OTP_LENGTH;

  // ── Countdown timer ──────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(TIMER_SECONDS);
    setExpired(false);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (isOtpFlow) startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isOtpFlow, startTimer]);

  // Focus first box on mount
  useEffect(() => {
    if (isOtpFlow) {
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    }
  }, [isOtpFlow]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // SVG ring progress
  const RADIUS = 36;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progress = timeLeft / TIMER_SECONDS;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const timerColor = timeLeft > 60 ? '#7367f0' : timeLeft > 30 ? '#f59e0b' : '#ef4444';

  // ── OTP input handlers ───────────────────────────────────────────────────────
  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) return;
    const char = cleaned[cleaned.length - 1]; // take last digit if pasted multiple
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setError('');
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (digits[index]) {
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && isComplete && !loading) {
      handleVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = [...digits];
    for (let i = 0; i < OTP_LENGTH; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setDigits(newDigits);
    setError('');
    const nextEmpty = newDigits.findIndex(d => !d);
    const focusIdx = nextEmpty === -1 ? OTP_LENGTH - 1 : nextEmpty;
    inputRefs.current[focusIdx]?.focus();
  };

  // ── Verify OTP ───────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!isComplete || loading) return;
    setLoading(true);
    setError('');
    try {
      const customToken = await verifyPasswordlessOtp(email, otp);
      await signInWithCustomToken(auth, customToken);

      const pendingName = sessionStorage.getItem('nexus_pending_name');
      if (pendingName && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: pendingName });
        sessionStorage.removeItem('nexus_pending_name');
        sessionStorage.removeItem('nexus_pending_age');
        sessionStorage.removeItem('nexus_pending_gender');
      }
      sessionStorage.removeItem('nexus_otp_required');

      onVerified(email, pendingName || auth.currentUser?.displayName || 'User');
    } catch (err: any) {
      setError(err.message || 'Could not verify the code.');
      // Shake the inputs on error
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resending || (!expired && timeLeft > TIMER_SECONDS - 60)) return;
    setResending(true);
    setError('');
    setSuccess('');
    try {
      await sendPasswordlessOtp(email);
      setDigits(Array(OTP_LENGTH).fill(''));
      setSuccess('A new code has been sent to your email!');
      startTimer();
      setTimeout(() => {
        setSuccess('');
        inputRefs.current[0]?.focus();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  const canResend = expired || timeLeft <= TIMER_SECONDS - 60;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="auth-view-container otp-view-container"
    >
      {/* Back button */}
      <button
        type="button"
        onClick={() => onNavigate(context === 'register' ? 'register' : 'login')}
        className="auth-back-btn"
        style={{ position: 'absolute', top: '0', left: '0' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="otp-header">
        {/* Animated mail envelope */}
        <div className="otp-mail-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <motion.rect
              x="4" y="10" width="32" height="22" rx="3"
              stroke="#7367f0" strokeWidth="2" fill="none"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <motion.path
              d="M4 13 L20 24 L36 13"
              stroke="#7367f0" strokeWidth="2" fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
            />
          </svg>
        </div>

        <h1 className="auth-title" style={{ marginTop: '1rem' }}>Check your email</h1>
        <p className="auth-subtitle" style={{ marginTop: '0.5rem' }}>
          {isOtpFlow
            ? 'We sent a 6-digit code to'
            : 'We sent a secure link to'}{' '}
          <br />
          <strong className="otp-email-highlight">{email}</strong>
        </p>
      </div>

      {isOtpFlow ? (
        <>
          {/* 5-minute countdown ring */}
          <div className="otp-timer-wrapper">
            <svg width="90" height="90" viewBox="0 0 90 90">
              {/* Background ring */}
              <circle
                cx="45" cy="45" r={RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="5"
              />
              {/* Progress ring */}
              <motion.circle
                cx="45" cy="45" r={RADIUS}
                fill="none"
                stroke={timerColor}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                style={{ transformOrigin: '45px 45px', transform: 'rotate(-90deg)' }}
                animate={{ strokeDashoffset, stroke: timerColor }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </svg>
            <div className="otp-timer-text" style={{ color: timerColor }}>
              {expired ? (
                <span className="otp-expired-label">Expired</span>
              ) : (
                <span>{minutes}:{seconds.toString().padStart(2, '0')}</span>
              )}
            </div>
          </div>

          <p className="otp-instruction">
            Enter the 6-digit code to complete verification
          </p>

          {/* 6-Box OTP Input */}
          <div className="otp-boxes" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <motion.input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={e => e.target.select()}
                className={`otp-box ${digit ? 'otp-box--filled' : ''} ${error ? 'otp-box--error' : ''}`}
                disabled={loading || expired}
                aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                animate={error ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
              />
            ))}
          </div>

          {/* Error / Success messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="auth-error-banner"
                style={{ marginTop: '0.75rem' }}
              >
                <span className="auth-error-dot" />
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="auth-success-banner"
                style={{ marginTop: '0.75rem' }}
              >
                ✓ {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Verify button */}
          <button
            type="button"
            className="auth-primary-btn"
            style={{ marginTop: '1.5rem' }}
            disabled={loading || !isComplete || expired}
            onClick={handleVerify}
          >
            {loading ? (
              <><span className="auth-spinner" /> Verifying…</>
            ) : (
              'Verify Code'
            )}
          </button>

          {/* Resend */}
          <div className="otp-resend-row">
            <span className="otp-resend-label">Didn't receive the code?</span>
            <button
              type="button"
              className={`otp-resend-btn ${canResend ? 'otp-resend-btn--active' : ''}`}
              onClick={handleResend}
              disabled={!canResend || resending}
            >
              {resending ? (
                <><span className="auth-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Sending…</>
              ) : (
                <><RefreshCw size={13} /> Resend code</>
              )}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="otp-instruction" style={{ marginTop: '1.5rem' }}>
            Please click the link in that email to reset your password.
          </p>
          <button
            type="button"
            className="auth-primary-btn"
            style={{ marginTop: '2rem' }}
            onClick={() => onNavigate('login')}
          >
            Back to Login
          </button>
        </>
      )}
    </motion.div>
  );
};
