import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, BadgeCheck,
  Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, ClipboardCheck, Clock3, Computer, FileCheck2, FilePlus2, Fingerprint,
  KeyRound, LayoutDashboard, LogOut, Menu, Moon, Plus, Search, Shield, ShieldCheck,
  Sun, UserRound, Users, X,
} from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import GuestPortal from './GuestPortal.jsx';
import { api } from './api.js';

const DEMO_PASSWORD = 'SageDemo2026!';
const FACILITIES_EMAIL = 'facility@feu.edu.ph';
const GUARD_EMAIL = 'guard@feu.edu.ph';
function formatDate(value, options = {}) {
  if (!value) return '—';
  const { time, ...formatOptions } = options;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
    ...formatOptions,
  }).format(new Date(value));
}

function getValidity(pass) {
  const now = Date.now();
  if (pass.approvalStatus === 'Pending') return { label: 'Awaiting approval', className: 'pending' };
  if (pass.approvalStatus === 'Rejected') return { label: 'Declined', className: 'rejected' };
  if (now < Date.parse(pass.validFrom)) return { label: 'Upcoming', className: 'upcoming' };
  if (now > Date.parse(pass.validUntil)) return { label: 'Expired', className: 'expired' };
  return { label: 'Active now', className: 'active' };
}

function Avatar({ name, small = false }) {
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className={`avatar ${small ? 'avatar-small' : ''}`}>{initials}</span>;
}

function StatusPill({ status }) {
  const style = status.toLowerCase().replaceAll(' ', '-');
  return <span className={`status-pill status-${style}`}><span className="status-dot" />{status}</span>;
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return <button
    className="theme-toggle"
    type="button"
    onClick={onToggle}
    aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    aria-pressed={isDark}
    title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
  >
    <span key={theme} className="theme-toggle-icon">{isDark ? <Sun size={18} /> : <Moon size={17} />}</span>
    <span className="theme-toggle-label">{isDark ? 'Light' : 'Dark'} mode</span>
  </button>;
}

function Login({ onLogin, onGuestLogin, onReferenceLookup, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState(import.meta.env.DEV ? FACILITIES_EMAIL : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? DEMO_PASSWORD : '');
  const [referenceId, setReferenceId] = useState('');
  const [profile, setProfile] = useState({ fullName: '', affiliation: '', contactNumber: '', govIdType: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'reference') {
        const result = await api(`/api/guest/passes/reference/${encodeURIComponent(referenceId.trim())}`);
        onReferenceLookup(result);
        return;
      }
      const path = mode === 'register' ? '/api/guest/auth/register' : '/api/auth/login';
      const body = mode === 'register' ? {
        ...profile,
        contactNumber: profile.contactNumber ? `+${profile.contactNumber.replace(/^\+/, '')}` : '',
        email,
        password,
      } : { email, password };
      const result = await api(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (result.staff) onLogin(result.staff);
      else onGuestLogin(result.guest, mode === 'register' ? result.emailSent : undefined);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <div className="login-ambient" aria-hidden="true"><span /><span /><span /></div>
      <div className="login-motion-art" aria-hidden="true">
        <span className="motion-orbit motion-orbit-one" />
        <span className="motion-orbit motion-orbit-two" />
        <span className="motion-orbit motion-orbit-three" />
        <span className="motion-core"><ShieldCheck size={52} strokeWidth={1.2} /></span>
        <span className="motion-scanline" />
      </div>
      <section className="login-hero">
        <div className="login-brand"><span className="brand-mark"><ShieldCheck size={23} /></span><span>SAGE<span className="login-brand-caption">SECURE ACCESS FOR GUESTS & EQUIPMENTS</span></span></div>
        <div className="login-message">
          <span className="eyebrow light-eyebrow"><span className="live-dot" /> FEU INSTITUTE OF TECHNOLOGY · CAMPUS ACCESS</span>
          <h1>Every arrival,<br /><em>beautifully</em><br />accounted for.</h1>
          <p>A calm, secure gateway for campus visits, equipment clearance, and the people who keep every movement accountable.</p>
        </div>
        <div className="login-visual-footer"><Shield size={15} /> VERIFIED ACCESS <span>·</span> CLEAR EQUIPMENT <span>·</span> TRUSTED RECORDS</div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand"><span className="brand-mark"><ShieldCheck size={22} /></span><span>SAGE<span className="login-brand-caption">CAMPUS ACCESS</span></span></div>
          <h1 className="login-promise"><strong>Pass</strong> <em>verified</em> <strong>seamlessly.</strong></h1>
          <span className="eyebrow">SECURE IDENTITY GATEWAY <span className="eyebrow-code">01 / AUTH</span></span>
          <h2>{mode === 'register' ? 'Create your visitor profile.' : mode === 'reference' ? 'Find your visitor pass.' : 'Welcome to SAGE.'}</h2>
          <p className="form-intro">{mode === 'register' ? 'Set up a profile to request and manage campus visits.' : mode === 'reference' ? 'Enter the Reference ID printed on your pass.' : 'Sign in to your workspace or visitor dashboard.'}</p>
          <form onSubmit={submit} className="login-form">
            {mode === 'register' && <>
              <label htmlFor="guest-name">Full name</label>
              <div className="input-with-icon"><UserRound size={17} /><input id="guest-name" autoComplete="name" value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} minLength="2" maxLength="120" required /></div>
              <label htmlFor="guest-affiliation">Affiliation <span className="optional">(optional)</span></label>
              <div className="input-with-icon"><Building2 size={17} /><input id="guest-affiliation" autoComplete="organization" value={profile.affiliation} onChange={(event) => setProfile({ ...profile, affiliation: event.target.value })} maxLength="120" /></div>
              <div className="guest-profile-fields"><div><label htmlFor="guest-phone">Contact number</label><PhoneInput country="ph" countryCodeEditable={false} value={profile.contactNumber} onChange={(contactNumber) => setProfile({ ...profile, contactNumber })} enableSearch searchPlaceholder="Search for countries" inputProps={{ id: 'guest-phone', name: 'contactNumber', autoComplete: 'tel', minLength: 8, maxLength: 25, required: true }} inputClass="guest-phone-input" containerClass="guest-phone-control" buttonClass="guest-phone-button" dropdownClass="guest-phone-dropdown" searchClass="guest-phone-search" /></div><div><label htmlFor="guest-id">Government ID</label><div className="input-with-icon"><input id="guest-id" value={profile.govIdType} onChange={(event) => setProfile({ ...profile, govIdType: event.target.value })} minLength="2" maxLength="60" placeholder="Passport" required /></div></div></div>
            </>}
            {mode === 'reference' ? <>
              <label htmlFor="reference-id">Visitor Reference ID</label>
              <div className="input-with-icon"><Fingerprint size={17} /><input id="reference-id" autoComplete="off" value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="SAGE-2026-…" maxLength="64" required /></div>
            </> : <>
              <label htmlFor="email">Email address</label>
              <div className="input-with-icon"><UserRound size={17} /><input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
              <label htmlFor="password">{mode === 'register' ? 'Create password' : 'Password'}</label>
              <div className="input-with-icon"><KeyRound size={17} /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'register' ? 10 : undefined} required /><button className="input-action" type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div>
              {mode === 'register' && <small className="password-hint">Use at least 10 characters.</small>}
            </>}
            {error && <div className="inline-error" role="alert">{error}</div>}
            <button type="submit" className="button button-primary login-submit" disabled={busy}>{busy ? 'Verifying…' : mode === 'register' ? 'Create account & continue' : mode === 'reference' ? 'View visitor pass' : 'Continue'}<ArrowRight size={17} /></button>
          </form>
          {mode === 'login' && <div className="login-alternatives">
            <button type="button" onClick={() => changeMode('reference')}><Fingerprint size={14} /> Look up a pass with Reference ID</button>
            <span>New visitor? <button type="button" onClick={() => changeMode('register')}>Create a profile</button></span>
          </div>}
          {(mode === 'reference' || mode === 'register') && <button className="auth-back-link" type="button" onClick={() => changeMode('login')}><ArrowRight size={13} /> Back to sign in</button>}
          {mode === 'login' && import.meta.env.DEV && <div className="demo-access">
            <div className="demo-heading"><span className="demo-icon"><CircleHelp size={17} /></span><div><strong>Prototype demo accounts</strong><span>Choose a workspace to prefill sign-in.</span></div></div>
            <div className="demo-buttons">
              <button type="button" className={email === FACILITIES_EMAIL ? 'selected' : ''} onClick={() => { setEmail(FACILITIES_EMAIL); setPassword(DEMO_PASSWORD); }}>Facilities officer</button>
              <button type="button" className={email === GUARD_EMAIL ? 'selected' : ''} onClick={() => { setEmail(GUARD_EMAIL); setPassword(DEMO_PASSWORD); }}>Security guard</button>
            </div>
            <small>Demo password: <code>{DEMO_PASSWORD}</code></small>
          </div>}
          <div className="login-security"><ShieldCheck size={15} /> Encrypted session <span>·</span> Auto-expires in 8 hours <span className="login-security-code">TLS 1.3</span></div>
        </div>
      </section>
    </main>
  );
}

function Topbar({ staff, query, setQuery, onSearch, onNewPass, onLogout, isFacilities, onMobileMenu }) {
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={onMobileMenu} aria-label="Open navigation"><Menu size={20} /></button>
      <form className="global-search" onSubmit={onSearch}>
        <Search size={18} />
        <input aria-label="Search passes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or reference ID..." />
        <kbd>↵</kbd>
      </form>
      <div className="topbar-actions">
        <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /></button>
        {isFacilities && <button className="button button-primary topbar-new" onClick={onNewPass}><Plus size={17} /><span>New pass</span></button>}
        <div className="topbar-divider" />
        <button className="profile-button" onClick={onLogout} title="Sign out">
          <Avatar name={staff.fullName} small />
          <span className="profile-copy"><strong>{staff.fullName}</strong><small>{staff.role}</small></span>
          <LogOut className="logout-icon" size={16} />
        </button>
      </div>
    </header>
  );
}

function Sidebar({ staff, section, setSection, onNewPass, mobileOpen, closeMobile }) {
  const isFacilities = staff.role === 'Facilities Officer';
  return (
    <>
      {mobileOpen && <button className="mobile-scrim" onClick={closeMobile} aria-label="Close navigation" />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark"><ShieldCheck size={23} /></span>
          <span className="brand-name">SAGE<small>Campus access</small></span>
          <button className="sidebar-close" onClick={closeMobile} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="workspace-chip"><span className="campus-mark"><Building2 size={16} /></span><span><strong>FEU</strong><strong>Institute of Technology</strong></span><ChevronDown size={14} /></div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="primary-nav">
          <button className={section === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('overview'); closeMobile(); }}><LayoutDashboard size={18} /><span>Overview</span></button>
          <button className={section === 'passes' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('passes'); closeMobile(); }}><ClipboardCheck size={18} /><span>Visitor passes</span></button>
          <button className={section === 'movements' ? 'nav-item active' : 'nav-item'} onClick={() => { setSection('movements'); closeMobile(); }}><Activity size={18} /><span>Gate activity</span></button>
        </nav>
        {isFacilities && <button className="sidebar-create" onClick={() => { onNewPass(); closeMobile(); }}><FilePlus2 size={17} /><span>Create a pass</span><Plus size={15} /></button>}
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span className="help-mark"><CircleHelp size={17} /></span><div><strong>Need a hand?</strong><small>View the staff guide</small></div><ChevronRight size={15} /></div>
          <div className="sidebar-user"><Avatar name={staff.fullName} small /><div><strong>{staff.fullName}</strong><small>{isFacilities ? 'Facilities team' : 'Campus security'}</small></div><span className="online-dot" /></div>
          <div className="sidebar-version">SAGE PROTOTYPE <span>v1.0</span></div>
        </div>
      </aside>
    </>
  );
}

function StatCard({ icon: Icon, label, value, note, tone, onClick }) {
  return <button type="button" className={`stat-card stat-${tone}`} onClick={onClick} aria-label={`${label}: ${value}. ${note}. Open details`}>
    <span className="stat-top"><span className="stat-icon"><Icon size={18} /></span><span className="stat-note">{note}</span><ChevronRight className="stat-chevron" size={15} /></span>
    <span className="stat-value">{value}</span><span className="stat-label">{label}</span>
    <span className="stat-expand-hint">Open snapshot <ArrowRight size={12} /></span>
  </button>;
}

function ActivityList({ logs, onPass }) {
  if (!logs.length) return <div className="empty-activity"><span><Activity size={20} /></span><strong>No movements yet</strong><p>Gate entries and exits will appear here.</p></div>;
  return <div className="activity-list">{logs.map((log) => <button className="activity-row" key={log.logId} onClick={() => onPass(log.referenceId)}>
    <span className={`movement-icon ${log.direction === 'IN' ? 'movement-in' : 'movement-out'}`}>{log.direction === 'IN' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
    <span className="activity-copy"><strong>{log.fullName}<small>{log.direction === 'IN' ? 'Checked in' : 'Checked out'}{log.assetDescription ? ` · ${log.assetDescription}` : ''}</small></strong><span>{log.referenceId}</span></span>
    <span className="activity-time">{formatDate(log.timestamp, { time: true })}<small>by {log.staffName}</small></span>
  </button>)}</div>;
}

function InsightDrawer({ insight, onClose, onOpenPass, onOpenReference }) {
  return <>
    <button className="drawer-scrim insight-scrim" onClick={onClose} aria-label="Close metric details" />
    <aside className="detail-drawer insight-drawer" role="dialog" aria-modal="true" aria-labelledby="insight-title" tabIndex="-1">
      <header className="insight-drawer-header">
        <div><span className="eyebrow">OPERATIONS SNAPSHOT</span><button className="drawer-close" onClick={onClose} aria-label="Close metric details"><X size={19} /></button></div>
        <p>LIVE METRIC</p>
        <h2 id="insight-title">{insight.label}</h2>
        <strong className="insight-value">{insight.value}</strong>
        <span className="insight-description">{insight.description}</span>
      </header>
      <div className="drawer-content insight-content">
        <div className="section-title-row"><h3>{insight.listTitle}</h3><span className="count-chip">{insight.passes.length.toString().padStart(2, '0')}</span></div>
        {insight.passes.length ? <div className="insight-pass-list">{insight.passes.map((pass) => <button className="insight-pass-row" key={pass.passId} onClick={() => onOpenPass(pass.passId)}>
          <Avatar name={pass.fullName} small />
          <span><strong>{pass.fullName}</strong><small>{pass.referenceId || 'Reference pending'} · {pass.hostDepartment}</small></span>
          <StatusPill status={getValidity(pass).label} />
          <ChevronRight size={15} />
        </button>)}</div> : <div className="insight-empty"><Activity size={18} /><span>No matching pass records in the latest register.</span></div>}
        {insight.logs.length > 0 && <div className="insight-recent"><span className="eyebrow">LATEST GATE ACTIVITY</span><ActivityList logs={insight.logs.slice(0, 4)} onPass={onOpenReference} /></div>}
      </div>
    </aside>
  </>;
}

function localDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function Overview({ staff, summary, passes, onOpenPass, onPass, onNewPass, onInsight, loading, query, setQuery, onSearch }) {
  const isFacilities = staff.role === 'Facilities Officer';
  const currentPasses = passes.filter((pass) => ['Approved', 'Pending'].includes(pass.approvalStatus)).slice(0, 5);
  const recentLogs = summary?.recentLogs || [];
  const todaysPasses = passes.filter((pass) => pass.createdAt && new Date(pass.createdAt).toDateString() === new Date().toDateString());
  const activePasses = passes.filter((pass) => getValidity(pass).className === 'active');
  const pendingPasses = passes.filter((pass) => pass.approvalStatus === 'Pending');
  const latestGuestPasses = passes.slice(0, 8);
  const metrics = [
    { key: 'today', icon: Users, label: 'Visitors today', value: summary?.today ?? '—', note: 'All registrations', tone: 'blue', description: 'Guest visit registrations created today.', listTitle: "Today's registrations", passes: todaysPasses },
    { key: 'active', icon: BadgeCheck, label: 'Active passes', value: summary?.active ?? '—', note: 'Valid right now', tone: 'green', description: 'Approved passes currently inside their access window.', listTitle: 'Active passes', passes: activePasses },
    { key: 'pending', icon: Clock3, label: 'Awaiting approval', value: summary?.pending ?? '—', note: isFacilities ? 'Needs your review' : 'Facilities review', tone: 'amber', description: 'Visit requests that are waiting for a facilities decision.', listTitle: 'Pending requests', passes: pendingPasses },
    { key: 'guests', icon: Fingerprint, label: 'Registered guests', value: summary?.guests ?? '—', note: 'All time', tone: 'purple', description: 'Recent visit records from guests registered with SAGE.', listTitle: 'Recent guest visits', passes: latestGuestPasses },
  ];
  return (
    <>
      <div className="welcome-row">
        <div><span className="eyebrow">{formatDate(new Date().toISOString(), { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}</span><h1>{isFacilities ? 'Good morning' : 'Gate overview'}, {staff.fullName.split(' ')[0]}<span className="wave">✦</span></h1><p>{isFacilities ? 'Here’s what’s happening across your campus access today.' : 'Everything you need to verify visitors and keep the gate moving.'}</p></div>
        {isFacilities && <button className="button button-primary welcome-new" onClick={onNewPass}><Plus size={17} /> Create visitor pass</button>}
      </div>
      {!isFacilities && <section className="scanner-card"><div className="scanner-mark"><Fingerprint size={21} /></div><div className="scanner-copy"><span className="eyebrow">GATE SCANNER</span><strong>Find a visitor pass</strong><small>Search by reference ID or visitor’s full name.</small></div><form onSubmit={onSearch}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. SAGE-2026-7K4P2M9Q or guest name" aria-label="Find a visitor pass" /><button className="button button-primary" type="submit"><span>Search passes</span><ArrowRight size={15} /></button></form><span className="scanner-live"><span className="live-dot" /> LIVE LOOKUP</span></section>}
      <section className="stat-grid">
        {metrics.map(({ key, ...metric }) => <StatCard key={key} {...metric} onClick={() => onInsight({ ...metric, logs: recentLogs })} />)}
      </section>
      <section className="dashboard-grid">
        <article className="panel pass-panel">
          <div className="panel-heading"><div><span className="eyebrow">ACCESS REGISTER</span><h2>{isFacilities ? 'Recent visitor passes' : 'Passes to verify'}</h2></div><button className="text-button" onClick={() => onOpenPass(null)}>View all <ArrowRight size={15} /></button></div>
          {loading ? <div className="loading-state">Loading passes…</div> : currentPasses.length ? <div className="compact-pass-list">{currentPasses.map((pass) => {
            const validity = getValidity(pass);
            return <button className="compact-pass-row" key={pass.passId} onClick={() => onOpenPass(pass.passId)}>
              <Avatar name={pass.fullName} />
              <span className="compact-person"><strong>{pass.fullName}</strong><small>{pass.referenceId || 'Reference assigned on approval'} · {pass.hostDepartment}</small></span>
              <span className="compact-end"><StatusPill status={validity.label} /><small>{formatDate(pass.validFrom, { time: true })}</small></span>
              <ChevronRight className="row-chevron" size={17} />
            </button>;
          })}</div> : <div className="empty-state"><span><FileCheck2 size={20} /></span><strong>No passes to show</strong><p>New registrations will appear here.</p>{isFacilities && <button className="text-button" onClick={onNewPass}>Create a pass <ArrowRight size={14} /></button>}</div>}
          <div className="panel-footer"><span><span className="live-dot" /> Live register</span><span>Updated just now</span></div>
        </article>
        <article className="panel activity-panel">
          <div className="panel-heading"><div><span className="eyebrow">LIVE MOVEMENTS</span><h2>Gate activity</h2></div><button className="icon-button subtle-icon" onClick={() => onPass(null)} aria-label="Refresh activity"><Activity size={17} /></button></div>
          <ActivityList logs={summary?.recentLogs || []} onPass={onPass} />
          <div className="panel-footer"><button className="text-button" onClick={() => onPass(null)}>All activity <ArrowRight size={14} /></button><span>Latest movements first</span></div>
        </article>
      </section>
      <section className="bottom-banner"><span className="banner-icon"><ShieldCheck size={19} /></span><div><strong>Every visit, verified.</strong><p>Always check the guest’s photo ID against their pass before granting entry.</p></div><span className="banner-tag">SAFETY FIRST</span></section>
    </>
  );
}

function PassesPage({ passes, loading, query, onSearch, onOpenPass, onNewPass, isFacilities }) {
  return <>
    <div className="page-heading"><div><span className="eyebrow">ACCESS REGISTER</span><h1>Visitor passes</h1><p>Search, review, and verify campus visitor access.</p></div>{isFacilities && <button className="button button-primary" onClick={onNewPass}><Plus size={17} /> New pass</button>}</div>
    <div className="panel register-panel">
      <div className="register-toolbar"><div className="register-count"><strong>{passes.length}</strong> passes {query && <>matching <strong>“{query}”</strong></>}</div><form className="table-search" onSubmit={onSearch}><Search size={16} /><input value={query} onChange={(event) => onSearch(event, true)} placeholder="Name or reference ID" /><kbd>↵</kbd></form></div>
      {loading ? <div className="loading-state">Searching passes…</div> : passes.length ? <div className="table-scroll"><table className="pass-table"><thead><tr><th>VISITOR</th><th>REFERENCE</th><th>HOST DEPARTMENT</th><th>VALIDITY</th><th>STATUS</th><th>EQUIPMENT</th><th /></tr></thead><tbody>{passes.map((pass) => {
        const validity = getValidity(pass);
        return <tr key={pass.passId} onClick={() => onOpenPass(pass.passId)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpenPass(pass.passId); }}>
          <td><span className="table-person"><Avatar name={pass.fullName} small /><span><strong>{pass.fullName}</strong><small>{pass.affiliation || 'Independent visitor'}</small></span></span></td>
          <td><span className="reference-code">{pass.referenceId || 'Pending'}</span></td>
          <td>{pass.hostDepartment}</td><td><span className="validity-cell">{formatDate(pass.validFrom, { time: true })}<small>until {formatDate(pass.validUntil, { time: true })}</small></span></td>
          <td><StatusPill status={validity.label} /></td><td>{pass.assetCount ? <span className="equipment-count"><Computer size={14} />{pass.assetCount}</span> : <span className="muted-cell">None</span>}</td><td><ChevronRight size={17} className="row-chevron" /></td>
        </tr>;
      })}</tbody></table></div> : <div className="empty-state"><span><Search size={20} /></span><strong>No matching passes</strong><p>Try a different name or reference ID.</p></div>}
      <div className="register-footer"><span>Showing up to 50 recent passes</span><span><ShieldCheck size={14} /> Records are access-controlled</span></div>
    </div>
  </>;
}

function MovementsPage({ logs, onPass, isFacilities }) {
  return <>
    <div className="page-heading"><div><span className="eyebrow">GATE ACTIVITY</span><h1>Movement history</h1><p>A live audit trail of guest and equipment entry and exit.</p></div><span className="live-badge"><span className="live-dot" /> LIVE LOG</span></div>
    <article className="panel movements-panel"><div className="panel-heading"><div><span className="eyebrow">RECENT RECORDS</span><h2>Latest gate movements</h2></div><span className="movement-retention">Newest 8 records</span></div>
      <ActivityList logs={logs} onPass={onPass} />
      <div className="movement-note"><ShieldCheck size={16} /><span>Each record is time-stamped and linked to the staff member who logged it.</span></div>
    </article>
    {!isFacilities && <div className="guard-hint"><Fingerprint size={18} /><span><strong>Identity check reminder</strong> Match a government photo ID with the guest details and pass before logging entry.</span></div>}
  </>;
}

function PassDetail({ pass, staff, onClose, onChanged, setNotice }) {
  const isFacilities = staff.role === 'Facilities Officer';
  const [busy, setBusy] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [editingWindow, setEditingWindow] = useState(false);
  const [windowValues, setWindowValues] = useState({ validFrom: '', validUntil: '' });
  const [windowError, setWindowError] = useState('');
  const [identityVerified, setIdentityVerified] = useState(false);
  const validity = getValidity(pass);
  const nextDirection = pass.guestDirection === 'IN' ? 'OUT' : 'IN';
  const selectedAsset = pass.assets.find((asset) => asset.assetId === Number(assetId));
  const assetNextDirection = selectedAsset?.lastDirection === 'IN' ? 'OUT' : 'IN';

  async function approve(status) {
    setBusy(true);
    try {
      const result = await api(`/api/passes/${pass.passId}/approval`, { method: 'PATCH', body: JSON.stringify({ status }) });
      onChanged(result.pass);
      setNotice(status === 'Approved' ? 'Pass approved and reference ID assigned.' : 'Pass declined.');
    } catch (error) {
      setNotice(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function saveValidity(event) {
    event.preventDefault();
    setBusy(true);
    setWindowError('');
    try {
      const result = await api(`/api/passes/${pass.passId}/validity`, {
        method: 'PATCH',
        body: JSON.stringify({
          validFrom: new Date(windowValues.validFrom).toISOString(),
          validUntil: new Date(windowValues.validUntil).toISOString(),
        }),
      });
      onChanged(result.pass);
      setEditingWindow(false);
      setNotice('Visit validity window updated.');
    } catch (error) {
      setWindowError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function clearAsset(id, status) {
    setBusy(true);
    try {
      await api(`/api/assets/${id}/clearance`, { method: 'PATCH', body: JSON.stringify({ status }) });
      const updated = await api(`/api/passes/${pass.passId}`);
      onChanged(updated.pass);
      setNotice(`Equipment ${status.toLowerCase()}.`);
    } catch (error) {
      setNotice(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function logMovement(direction, selectedAssetId = null) {
    setBusy(true);
    try {
      await api(`/api/passes/${pass.passId}/logs`, {
        method: 'POST',
        body: JSON.stringify({ direction, assetId: selectedAssetId ? Number(selectedAssetId) : null }),
      });
      const updated = await api(`/api/passes/${pass.passId}`);
      onChanged(updated.pass);
      setIdentityVerified(false);
      setNotice(`${selectedAssetId ? 'Equipment' : 'Guest'} ${direction === 'IN' ? 'entry' : 'exit'} recorded.`);
    } catch (error) {
      setNotice(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  return <><button className="drawer-scrim" onClick={onClose} aria-label="Close pass details" />  <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="pass-drawer-title" tabIndex="-1">
    <div className="drawer-top"><div><span className="eyebrow">PASS DETAILS</span><button className="drawer-close" onClick={onClose} aria-label="Close"><X size={19} /></button></div><div className="drawer-person"><Avatar name={pass.fullName} /><div><h2 id="pass-drawer-title">{pass.fullName}</h2><p>{pass.affiliation || 'Independent visitor'} <span>·</span> {pass.govIdType}</p></div></div>
      <div className="drawer-reference">{pass.referenceId ? <><span>REFERENCE ID</span><strong>{pass.referenceId}</strong><button className="copy-button" onClick={() => navigator.clipboard?.writeText(pass.referenceId).then(() => setNotice('Reference ID copied.'))}>Copy</button></> : <><span>REFERENCE ID</span><strong className="muted-cell">Assigned on approval</strong></>}</div>
    </div>
    <div className="drawer-content">
      <div className="drawer-status-row"><span className="eyebrow">CURRENT STATUS</span><StatusPill status={validity.label} /></div>
      <div className="detail-section"><div className="section-title-row"><h3>Visit details</h3>{isFacilities && pass.approvalStatus !== 'Rejected' && <button className="text-button edit-window-button" onClick={() => { setWindowValues({ validFrom: localDateTime(pass.validFrom), validUntil: localDateTime(pass.validUntil) }); setWindowError(''); setEditingWindow(true); }}>Edit window <CalendarDays size={13} /></button>}</div><div className="detail-grid"><div className="detail-field"><span><Building2 size={14} /> HOST DEPARTMENT</span><strong>{pass.hostDepartment}</strong></div><div className="detail-field"><span><CalendarDays size={14} /> VALID FROM</span><strong>{formatDate(pass.validFrom, { time: true })}</strong></div><div className="detail-field"><span><Clock3 size={14} /> VALID UNTIL</span><strong>{formatDate(pass.validUntil, { time: true })}</strong></div><div className="detail-field"><span><UserRound size={14} /> CONTACT</span><strong>{pass.contactNumber}</strong></div></div>{editingWindow && <form className="validity-editor" onSubmit={saveValidity}><label>Valid from<input required type="datetime-local" value={windowValues.validFrom} onChange={(event) => setWindowValues({ ...windowValues, validFrom: event.target.value })} /></label><label>Valid until<input required type="datetime-local" value={windowValues.validUntil} onChange={(event) => setWindowValues({ ...windowValues, validUntil: event.target.value })} /></label>{windowError && <div className="inline-error" role="alert">{windowError}</div>}<div><button className="button button-outline" type="button" onClick={() => setEditingWindow(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save window'}</button></div></form>}<div className="purpose-box"><span>PURPOSE OF VISIT</span><p>{pass.purpose}</p></div></div>
      <div className="detail-section equipment-section"><div className="section-title-row"><h3>Equipment clearance</h3><span className="count-chip">{pass.assets.length} {pass.assets.length === 1 ? 'item' : 'items'}</span></div>
        {pass.assets.length ? <div className="asset-list">{pass.assets.map((asset) => <div className="asset-card" key={asset.assetId}><span className="asset-icon"><Computer size={17} /></span><div className="asset-info"><strong>{asset.itemDescription}</strong><small>Serial no. {asset.serialNumber}</small></div><StatusPill status={asset.clearanceStatus} />{isFacilities && pass.approvalStatus === 'Approved' && asset.clearanceStatus === 'Pending' && <div className="asset-actions"><button title="Clear item" onClick={() => clearAsset(asset.assetId, 'Cleared')} disabled={busy}><Check size={14} /></button><button title="Deny item" onClick={() => clearAsset(asset.assetId, 'Denied')} disabled={busy}><X size={14} /></button></div>}</div>)}</div> : <div className="no-assets"><CheckCircle2 size={16} /> No equipment registered for this visit.</div>}
      </div>
      {isFacilities && pass.approvalStatus === 'Pending' && <div className="approval-callout"><span className="approval-icon"><FileCheck2 size={18} /></span><div><strong>Approval required</strong><p>Review the visit details and validity before making a decision.</p><div className="approval-actions"><button className="button button-primary" disabled={busy} onClick={() => approve('Approved')}><Check size={15} /> Approve pass</button><button className="button button-danger-ghost" disabled={busy} onClick={() => approve('Rejected')}>Decline</button></div></div></div>}
      {pass.approvalStatus === 'Approved' && validity.className === 'active' && <div className="gate-section"><div className="section-title-row"><h3>Gate verification</h3><span className="gate-ready"><span className="live-dot" /> READY</span></div><div className="id-check"><Fingerprint size={17} /><span>Confirm the government photo ID matches the visitor on this pass.</span></div><label className="identity-check"><input type="checkbox" checked={identityVerified} onChange={(event) => setIdentityVerified(event.target.checked)} /><span><strong>Identity verified</strong><small>Name and photo ID match the pass record.</small></span><CheckCircle2 size={16} /></label><div className="gate-actions"><button className="button button-gate-in" disabled={busy || !identityVerified || nextDirection !== 'IN'} onClick={() => logMovement('IN')}><ArrowDownLeft size={16} /> Record entry</button><button className="button button-gate-out" disabled={busy || !identityVerified || nextDirection !== 'OUT'} onClick={() => logMovement('OUT')}><ArrowUpRight size={16} /> Record exit</button></div>{pass.assets.some((asset) => asset.clearanceStatus === 'Cleared') && <div className="asset-gate"><label htmlFor="asset-movement">Optional equipment movement</label><div><select id="asset-movement" value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">Select cleared equipment…</option>{pass.assets.filter((asset) => asset.clearanceStatus === 'Cleared').map((asset) => <option value={asset.assetId} key={asset.assetId}>{asset.itemDescription} · {asset.serialNumber}</option>)}</select><button className="button button-outline" disabled={busy || !identityVerified || !assetId || assetNextDirection !== 'IN'} onClick={() => logMovement('IN', assetId)}><ArrowDownLeft size={15} /> Item in</button><button className="button button-outline" disabled={busy || !identityVerified || !assetId || assetNextDirection !== 'OUT'} onClick={() => logMovement('OUT', assetId)}><ArrowUpRight size={15} /> Item out</button></div></div>}</div>}
      <div className="detail-section history-section"><div className="section-title-row"><h3>Movement history</h3><span className="count-chip">{pass.logs.length}</span></div>{pass.logs.length ? <div className="history-list">{pass.logs.map((log) => <div className="history-row" key={log.logId}><span className={`movement-icon ${log.direction === 'IN' ? 'movement-in' : 'movement-out'}`}>{log.direction === 'IN' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}</span><div><strong>{log.assetDescription || 'Guest'} checked {log.direction === 'IN' ? 'in' : 'out'}</strong><small>{formatDate(log.timestamp, { time: true })} · Logged by {log.staffName} (ID {log.staffId})</small></div></div>)}</div> : <div className="no-assets">No movements recorded for this pass.</div>}</div>
    </div>
    <div className="drawer-footer"><span><ShieldCheck size={15} /> SAGE secure record</span><button className="text-button" onClick={onClose}>Close details</button></div>
  </aside></>;
}

function PassForm({ onClose, onCreated, setNotice }) {
  const [busy, setBusy] = useState(false);
  const [assets, setAssets] = useState([]);
  const [assetDraft, setAssetDraft] = useState({ itemDescription: '', serialNumber: '' });
  const [error, setError] = useState('');
  const start = new Date(Date.now() + 60 * 60 * 1000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const [values, setValues] = useState({
    fullName: '', email: '', affiliation: '', contactNumber: '', govIdType: '',
    hostDepartment: '', purpose: '',
    validFrom: new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    validUntil: new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
  });
  function update(field, value) { setValues((current) => ({ ...current, [field]: value })); }
  function addAsset() {
    if (!assetDraft.itemDescription.trim() || !assetDraft.serialNumber.trim()) return;
    setAssets((current) => [...current, { ...assetDraft }]);
    setAssetDraft({ itemDescription: '', serialNumber: '' });
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        guest: {
          fullName: values.fullName, affiliation: values.affiliation,
          email: values.email, contactNumber: values.contactNumber, govIdType: values.govIdType,
        },
        hostDepartment: values.hostDepartment, purpose: values.purpose,
        validFrom: new Date(values.validFrom).toISOString(),
        validUntil: new Date(values.validUntil).toISOString(),
        assets,
      };
      const result = await api('/api/passes', { method: 'POST', body: JSON.stringify(payload) });
      onCreated(result.pass);
      setNotice(
        result.emailSent
          ? 'Pass submitted for approval. A confirmation email was sent to the guest.'
          : 'Pass submitted, but the guest confirmation email could not be sent.',
        !result.emailSent,
      );
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }
  return <><button className="modal-scrim" onClick={onClose} aria-label="Close new pass form" /><section className="pass-modal" role="dialog" aria-modal="true" aria-labelledby="new-pass-title">
    <div className="modal-header"><div><span className="eyebrow">VISITOR REGISTRATION</span><h2 id="new-pass-title">Create a new pass</h2><p>Register a guest and submit their visit for approval.</p></div><button className="drawer-close" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
    <form onSubmit={submit} className="pass-form">
      <div className="form-section"><div className="form-section-heading"><span className="form-section-number">01</span><div><strong>Guest information</strong><small>Verify these details against a government-issued ID.</small></div></div>
        <div className="form-grid"><label>Full name<input required minLength="2" maxLength="120" value={values.fullName} onChange={(event) => update('fullName', event.target.value)} placeholder="As shown on photo ID" /></label><label>Email address<input required type="email" maxLength="254" value={values.email} onChange={(event) => update('email', event.target.value)} placeholder="guest@example.com" /></label><label>Affiliation <span className="optional">(optional)</span><input maxLength="120" value={values.affiliation} onChange={(event) => update('affiliation', event.target.value)} placeholder="Organization or institution" /></label><label>Contact number<input required minLength="5" maxLength="40" value={values.contactNumber} onChange={(event) => update('contactNumber', event.target.value)} placeholder="+1 (555) 000-0000" /></label><label>Government ID type<input required minLength="2" maxLength="60" value={values.govIdType} onChange={(event) => update('govIdType', event.target.value)} placeholder="Passport, driver license…" /></label></div>
      </div>
      <div className="form-section"><div className="form-section-heading"><span className="form-section-number">02</span><div><strong>Visit details</strong><small>Set a strict time window for campus access.</small></div></div>
        <div className="form-grid"><label>Host department<input required minLength="2" maxLength="100" value={values.hostDepartment} onChange={(event) => update('hostDepartment', event.target.value)} placeholder="e.g. Research & Innovation" /></label><label>Purpose of visit<input required minLength="3" maxLength="500" value={values.purpose} onChange={(event) => update('purpose', event.target.value)} placeholder="Brief reason for the visit" /></label><label>Valid from<input required type="datetime-local" value={values.validFrom} onChange={(event) => update('validFrom', event.target.value)} /></label><label>Valid until<input required type="datetime-local" value={values.validUntil} onChange={(event) => update('validUntil', event.target.value)} /></label></div>
      </div>
      <div className="form-section asset-form-section"><div className="form-section-heading"><span className="form-section-number">03</span><div><strong>Equipment to clear <span className="optional">(optional)</span></strong><small>Each item is individually reviewed before gate entry.</small></div></div>
        <div className="asset-draft-row"><input aria-label="Item description" value={assetDraft.itemDescription} onChange={(event) => setAssetDraft({ ...assetDraft, itemDescription: event.target.value })} placeholder="Item description" /><input aria-label="Serial number" value={assetDraft.serialNumber} onChange={(event) => setAssetDraft({ ...assetDraft, serialNumber: event.target.value })} placeholder="Serial number" /><button className="button button-outline add-asset-button" type="button" onClick={addAsset} disabled={!assetDraft.itemDescription.trim() || !assetDraft.serialNumber.trim()}><Plus size={15} /> Add</button></div>
        {!!assets.length && <div className="draft-assets">{assets.map((asset, index) => <div key={`${asset.serialNumber}-${index}`}><Computer size={15} /><span><strong>{asset.itemDescription}</strong><small>{asset.serialNumber}</small></span><button type="button" aria-label={`Remove ${asset.itemDescription}`} onClick={() => setAssets(assets.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button></div>)}</div>}
      </div>
      {error && <div className="inline-error form-error" role="alert">{error}</div>}
      <div className="modal-footer"><span><ShieldCheck size={15} /> Pass starts pending approval</span><div><button className="button button-outline" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Submit for approval'}<ArrowRight size={16} /></button></div></div>
    </form>
  </section></>;
}

function Toast({ notice, onDismiss }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);
  if (!notice) return null;
  return <div role="status" className={`toast ${notice.error ? 'toast-error' : ''}`}><span>{notice.error ? <X size={17} /> : <CheckCircle2 size={17} />}</span><strong>{notice.text}</strong><button onClick={onDismiss} aria-label="Dismiss"><X size={16} /></button></div>;
}

export default function App() {
  const [staff, setStaff] = useState(null);
  const [referencePass, setReferencePass] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('sage-theme') === 'light' ? 'light' : 'dark');
  const [checkingSession, setCheckingSession] = useState(true);
  const [section, setSection] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [passes, setPasses] = useState([]);
  const [selectedPass, setSelectedPass] = useState(null);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNoticeState] = useState(null);
  const isFacilities = staff?.role === 'Facilities Officer';
  const dialogKey = selectedPass ? 'pass' : selectedInsight ? 'insight' : showForm ? 'form' : null;
  const setNotice = useCallback((text, error = false) => setNoticeState({ text, error }), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('sage-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!dialogKey) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    document.body.style.overflow = 'hidden';
    dialog?.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedPass(null);
        setSelectedInsight(null);
        setShowForm(false);
        return;
      }
      if (event.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
          .filter((element) => element.offsetParent !== null);
        if (!focusable.length) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault();
          focusable.at(-1).focus();
        } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [dialogKey]);

  const loadSummary = useCallback(async () => {
    const result = await api('/api/summary');
    setSummary(result);
  }, []);

  const loadPasses = useCallback(async (term = '') => {
    setLoading(true);
    try {
      const result = await api(`/api/passes?q=${encodeURIComponent(term)}`);
      setPasses(result.passes);
    } catch (error) {
      setNotice(error.message, true);
    } finally {
      setLoading(false);
    }
  }, [setNotice]);

  useEffect(() => {
    async function restoreSession() {
      try {
        const result = await api('/api/auth/session');
        setStaff(result.staff);
      } catch (staffError) {
        if (staffError.status !== 401) {
          setNotice(staffError.message, true);
          setCheckingSession(false);
          return;
        }
        try {
          const result = await api('/api/guest/auth/session');
          setStaff(result.guest);
        } catch (guestError) {
          if (guestError.status !== 401) setNotice(guestError.message, true);
        }
      } finally {
        setCheckingSession(false);
      }
    }
    restoreSession();
  }, [setNotice]);

  useEffect(() => {
    if (!staff || staff.role === 'Guest / Visitor') return undefined;
    const timer = setTimeout(() => {
      setSearch(query.trim());
    }, 120);
    return () => clearTimeout(timer);
  }, [query, staff]);

  useEffect(() => {
    if (!staff || staff.role === 'Guest / Visitor') return;
    loadSummary().catch((error) => setNotice(error.message, true));
    loadPasses(search);
  }, [staff, loadSummary, loadPasses, search, setNotice]);

  const logs = useMemo(() => summary?.recentLogs || [], [summary]);

  async function openPass(passId) {
    setSelectedInsight(null);
    if (!passId) {
      setSection('movements');
      return;
    }
    try {
      const result = await api(`/api/passes/${passId}`);
      setSelectedPass(result.pass);
    } catch (error) {
      setNotice(error.message, true);
    }
  }

  async function openByReference(referenceId) {
    if (!referenceId) {
      setSection('movements');
      return;
    }
    const result = await api(`/api/passes?q=${encodeURIComponent(referenceId)}`);
    const match = result.passes.find((pass) => pass.referenceId === referenceId);
    if (match) await openPass(match.passId);
  }

  function submitSearch(event, defer = false) {
    if (event) event.preventDefault();
    if (defer) return;
    setSearch(query.trim());
    setSection('passes');
  }

  function onLogin(nextStaff) {
    setReferencePass(null);
    setStaff(nextStaff);
    setSection('overview');
    setNotice(`Welcome back, ${nextStaff.fullName.split(' ')[0]}.`);
  }

  function onGuestLogin(guest, welcomeEmailSent) {
    setReferencePass(null);
    setStaff(guest);
    const firstName = guest.fullName.split(' ')[0];
    setNotice(
      welcomeEmailSent === false
        ? `Your account was created, but the welcome email could not be sent.`
        : welcomeEmailSent === true
          ? `Welcome, ${firstName}. A welcome email was sent to ${guest.email}.`
          : `Welcome, ${firstName}. Your visitor portal is ready.`,
      welcomeEmailSent === false,
    );
  }

  function onReferenceLookup(result) {
    setReferencePass(result.pass);
    setStaff(result.guest);
    setNotice(`Visitor pass found for ${result.guest.fullName}.`);
  }

  async function logout() {
    try {
      if (!referencePass) {
        await api(staff?.role === 'Guest / Visitor' ? '/api/guest/auth/logout' : '/api/auth/logout', { method: 'POST' });
      }
      setStaff(null);
      setReferencePass(null);
      setSummary(null);
      setSelectedPass(null);
      setQuery('');
      setSearch('');
    } catch (error) {
      setNotice(error.message, true);
    }
  }

  function updatePass(updated) {
    setSelectedPass(updated);
    loadPasses(search);
    loadSummary().catch((error) => setNotice(error.message, true));
  }

  function createdPass(pass) {
    loadPasses('');
    loadSummary().catch((error) => setNotice(error.message, true));
    setQuery('');
    setSearch('');
    setSelectedPass(pass);
    setSection('passes');
  }

  if (checkingSession) return <><div className="app-loading"><span className="brand-mark"><ShieldCheck size={22} /></span><span>Preparing secure workspace…</span></div><ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} /></>;
  if (!staff) return <><Login onLogin={onLogin} onGuestLogin={onGuestLogin} onReferenceLookup={onReferenceLookup} theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} /><Toast notice={notice} onDismiss={() => setNoticeState(null)} /></>;
  if (staff.role === 'Guest / Visitor') {
    return <><GuestPortal guest={staff} onLogout={logout} setNotice={setNotice} referencePass={referencePass} /><ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} /><Toast notice={notice} onDismiss={() => setNoticeState(null)} /></>;
  }
  return <div className="app-shell">
    <Sidebar staff={staff} section={section} setSection={setSection} onNewPass={() => setShowForm(true)} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} />
    <main className="main-shell">
      <Topbar staff={staff} query={query} setQuery={setQuery} onSearch={submitSearch} onNewPass={() => setShowForm(true)} onLogout={logout} isFacilities={isFacilities} onMobileMenu={() => setMobileOpen(true)} />
      <div className="page-content">
        {section === 'overview' && <Overview staff={staff} summary={summary} passes={passes} onOpenPass={(id) => id ? openPass(id) : setSection('passes')} onPass={openByReference} onNewPass={() => setShowForm(true)} onInsight={setSelectedInsight} loading={loading} query={query} setQuery={setQuery} onSearch={submitSearch} />}
        {section === 'passes' && <PassesPage passes={passes} loading={loading} query={query} onSearch={submitSearch} onOpenPass={openPass} onNewPass={() => setShowForm(true)} isFacilities={isFacilities} />}
        {section === 'movements' && <MovementsPage logs={logs} onPass={openByReference} isFacilities={isFacilities} />}
      </div>
      <footer className="app-footer"><span>© 2026 SAGE campus access</span><span><span className="footer-shield"><ShieldCheck size={13} /></span> Staff-only system <span className="footer-separator">·</span> Data is securely stored</span></footer>
    </main>
    {selectedPass && <PassDetail pass={selectedPass} staff={staff} onClose={() => setSelectedPass(null)} onChanged={updatePass} setNotice={setNotice} />}
    {selectedInsight && <InsightDrawer insight={selectedInsight} onClose={() => setSelectedInsight(null)} onOpenPass={openPass} onOpenReference={openByReference} />}
    {showForm && <PassForm onClose={() => setShowForm(false)} onCreated={createdPass} setNotice={setNotice} />}
    <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
    <Toast notice={notice} onDismiss={() => setNoticeState(null)} />
  </div>;
}
