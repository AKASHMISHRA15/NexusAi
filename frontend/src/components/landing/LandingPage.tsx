import React from 'react';
import { ArrowRight, Bot, ShieldCheck, Sparkles, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAgentStore } from '../../stores/agentStore';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, setAppScreen } = useAgentStore();
  const launchAgent = () => setAppScreen(isAuthenticated ? 'agent' : 'auth');

  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <button className="landing-brand" onClick={() => setAppScreen('landing')} aria-label="NexusAI home">
          <span className="landing-brand-mark"><Bot size={18} /></span>
          <span>Nexus<span>AI</span></span>
        </button>
        <div className="landing-links" aria-label="Landing navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#skills">Skills</a>
        </div>
        <div className="landing-actions">
          {isAuthenticated ? (
            <button className="landing-auth-btn" onClick={async () => { await signOut(auth); localStorage.removeItem('nexus_google_session'); setAppScreen('landing'); }}>
              <LogOut size={16} /> Sign Out
            </button>
          ) : (
            <button className="landing-auth-btn" onClick={() => setAppScreen('auth')}>
              <ShieldCheck size={16} /> Authentication
            </button>
          )}
          <button className="landing-launch-btn" onClick={launchAgent}>
            <Bot size={17} /> Launch Agent
          </button>
        </div>
      </nav>

      <section className="landing-hero" id="features">
        <div className="landing-orb landing-orb-one" />
        <div className="landing-orb landing-orb-two" />
        <div className="landing-kicker"><Sparkles size={16} /> Agentic AI Operating Layer</div>
        <h1>Your devices.<br /><span>Commanded</span><br />by intelligence.</h1>
        <p>
          NexusAI is the intelligent operating layer between you and every application you use.
          Describe what you want—in text, voice, or images—and NexusAI reasons, plans, and executes across your software.
        </p>
        <div className="landing-cta-row">
          <button className="landing-launch-btn landing-hero-cta" onClick={launchAgent}><Bot size={18} /> Launch Agent</button>
          <a href="#how-it-works" className="landing-secondary-cta">See how it works <ArrowRight size={17} /></a>
        </div>
      </section>

      <section className="landing-feature-strip" id="how-it-works">
        <div><strong>01</strong><span>Understand natural-language requests</span></div>
        <div><strong>02</strong><span>Plan and use the right local tools</span></div>
        <div id="skills"><strong>03</strong><span>Work across apps, files, web, and vision</span></div>
      </section>
    </main>
  );
};
