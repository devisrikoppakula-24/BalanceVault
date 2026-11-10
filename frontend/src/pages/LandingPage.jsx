import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const features = [
  { title: 'Verified onboarding', text: 'Review accounts before they become active.', icon: ShieldCheck },
  { title: 'Ledger visibility', text: 'Trace every deposit, withdrawal, and transfer.', icon: TrendingUp },
  { title: 'Security-first controls', text: 'Secure authentication and role-based access.', icon: CheckCircle2 },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing-page">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">B</div>
          <span>BalanceVault</span>
        </div>
        <nav className="nav-actions">
          {!user ? (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register" className="button primary">Create account</Link>
            </>
          ) : (
            <Link to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} className="button primary">
              Open workspace
            </Link>
          )}
        </nav>
      </header>

      <main className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Secure account management</p>
          <h1>Money movement with a ledger you can prove.</h1>
          <p className="subtext">
            BalanceVault gives users a managed, auditable account experience with onboarding review, ledger transparency,
            and admin oversight built for fintech demos.
          </p>
          <div className="cta-row">
            <Link to="/register" className="button primary large">Get started <ArrowRight size={18} /></Link>
            <Link to="/login" className="button secondary large">Sign in</Link>
          </div>
          <ul className="mini-points">
            <li>RBAC protected</li>
            <li>Ledger tracking</li>
            <li>Admin controls</li>
          </ul>
        </div>

        <div className="hero-panel card">
          <div className="panel-header">
            <div>
              <span className="label">Portfolio</span>
              <h3>$74,620.00</h3>
            </div>
            <span className="pill success">Healthy</span>
          </div>

          <div className="stat-grid">
            <div>
              <span>Available</span>
              <strong>$18,420</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>$4,230</strong>
            </div>
            <div>
              <span>Transfers</span>
              <strong>32</strong>
            </div>
            <div>
              <span>Audits</span>
              <strong>146</strong>
            </div>
          </div>

          <div className="activity-list">
            <div>
              <span>Payroll deposit</span>
              <strong>+$2400</strong>
            </div>
            <div>
              <span>Subscription</span>
              <strong>-$82</strong>
            </div>
            <div>
              <span>Wire transfer</span>
              <strong>+$850</strong>
            </div>
          </div>
        </div>
      </main>

      <section className="feature-grid">
        {features.map(({ title, text, icon: Icon }) => (
          <div className="feature card" key={title}>
            <div className="feature-icon"><Icon size={18} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
