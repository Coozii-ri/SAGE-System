import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowRight, BadgeCheck, CalendarDays,
  CheckCircle2, ChevronRight, Clock3, Computer, FilePlus2, Fingerprint,
  LogOut, Plus, QrCode, RefreshCw, ShieldCheck, UserRound, X,
} from 'lucide-react';

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Something went wrong.');
  return payload;
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

function validity(pass) {
  const now = Date.now();
  if (pass.approvalStatus === 'Pending') return { label: 'In review', className: 'pending' };
  if (pass.approvalStatus === 'Rejected') return { label: 'Not approved', className: 'rejected' };
  if (now < Date.parse(pass.validFrom)) return { label: 'Upcoming', className: 'upcoming' };
  if (now > Date.parse(pass.validUntil)) return { label: 'Expired', className: 'expired' };
  return { label: 'Active pass', className: 'active' };
}

function localDateTime(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function QRPass({ referenceId }) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    if (!referenceId) {
      setImage('');
      return () => { active = false; };
    }
    QRCode.toDataURL(referenceId, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 176,
      color: { dark: '#12232a', light: '#ffffff' },
    }).then((dataUrl) => {
      if (active) setImage(dataUrl);
    }).catch(() => {
      if (active) setError('QR is temporarily unavailable.');
    });
    return () => { active = false; };
  }, [referenceId]);

  if (!referenceId) return <div className="visitor-qr-placeholder"><Clock3 size={24} /><span>QR available after approval</span></div>;
  if (error) return <div className="visitor-qr-placeholder"><QrCode size={24} /><span>{error}</span></div>;
  return image
    ? <img className="visitor-qr-image" src={image} alt={`QR code for pass ${referenceId}`} />
    : <div className="visitor-qr-placeholder"><QrCode size={24} /><span>Generating pass code…</span></div>;
}

function VisitorRequestForm({ guest, onClose, onCreated }) {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const [values, setValues] = useState({
    hostDepartment: '',
    purpose: '',
    validFrom: localDateTime(start),
    validUntil: localDateTime(end),
  });
  const [asset, setAsset] = useState({ itemDescription: '', serialNumber: '' });
  const [assets, setAssets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const result = await api('/api/guest/passes', {
        method: 'POST',
        body: JSON.stringify({
          hostDepartment: values.hostDepartment,
          purpose: values.purpose,
          validFrom: new Date(values.validFrom).toISOString(),
          validUntil: new Date(values.validUntil).toISOString(),
          assets,
        }),
      });
      onCreated(result.pass);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="visitor-request-card">
    <div className="visitor-request-heading"><div><span className="eyebrow">NEW VISIT REQUEST</span><h2>Plan your campus visit</h2><p>Your request is sent to the host department for approval.</p></div><button className="visitor-icon-button" onClick={onClose} aria-label="Close form"><X size={18} /></button></div>
    <form className="visitor-request-form" onSubmit={submit}>
      <div className="visitor-profile-summary"><span className="visitor-avatar">{guest.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><strong>{guest.fullName}</strong><small>{guest.email} · {guest.affiliation || 'Visitor'}</small></div><span className="verified-profile"><BadgeCheck size={14} /> PROFILE</span></div>
      <div className="visitor-form-grid">
        <label>Host department<input required minLength="2" maxLength="100" placeholder="e.g. Research & Innovation" value={values.hostDepartment} onChange={(event) => setValues({ ...values, hostDepartment: event.target.value })} /></label>
        <label>Purpose of visit<input required minLength="3" maxLength="500" placeholder="What brings you to campus?" value={values.purpose} onChange={(event) => setValues({ ...values, purpose: event.target.value })} /></label>
        <label>Arrival<input required type="datetime-local" value={values.validFrom} onChange={(event) => setValues({ ...values, validFrom: event.target.value })} /></label>
        <label>Departure<input required type="datetime-local" value={values.validUntil} onChange={(event) => setValues({ ...values, validUntil: event.target.value })} /></label>
      </div>
      <div className="visitor-assets-form"><div><strong>Equipment to bring</strong><small>Items are reviewed individually before entry.</small></div><div className="visitor-asset-inputs"><input aria-label="Equipment description" placeholder="Description" value={asset.itemDescription} onChange={(event) => setAsset({ ...asset, itemDescription: event.target.value })} /><input aria-label="Equipment serial number" placeholder="Serial number" value={asset.serialNumber} onChange={(event) => setAsset({ ...asset, serialNumber: event.target.value })} /><button className="visitor-secondary-button" type="button" disabled={!asset.itemDescription.trim() || !asset.serialNumber.trim()} onClick={() => { setAssets([...assets, asset]); setAsset({ itemDescription: '', serialNumber: '' }); }}><Plus size={15} /> Add</button></div>
        {!!assets.length && <div className="visitor-added-assets">{assets.map((item, index) => <div key={`${item.serialNumber}-${index}`}><Computer size={15} /><span>{item.itemDescription}<small>{item.serialNumber}</small></span><button type="button" onClick={() => setAssets(assets.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.itemDescription}`}><X size={14} /></button></div>)}</div>}
      </div>
      {formError && <div className="visitor-form-error" role="alert">{formError}</div>}
      <div className="visitor-request-footer"><span><ShieldCheck size={15} /> Your identity details stay on your pass record.</span><div><button type="button" className="visitor-secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="visitor-primary-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}<ArrowRight size={15} /></button></div></div>
    </form>
  </section>;
}

function PassCard({ pass, selected, onSelect }) {
  const status = validity(pass);
  return <button className={`visitor-pass-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <span className="visitor-pass-indicator"><span className={`visitor-status-light ${status.className}`} /></span>
    <span className="visitor-pass-row-copy"><strong>{pass.hostDepartment}</strong><small>{pass.purpose}</small><span>{pass.referenceId || 'Reference assigned after approval'}</span></span>
    <span className={`visitor-mini-status ${status.className}`}>{status.label}</span>
    <ChevronRight size={16} />
  </button>;
}

export default function GuestPortal({ guest, onLogout, setNotice }) {
  const [passes, setPasses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await api('/api/guest/passes');
      setPasses(result.passes);
      setSelectedId((current) => current && result.passes.some((pass) => pass.passId === current)
        ? current
        : result.passes[0]?.passId ?? null);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh(true);
    }, 12000);
    return () => clearInterval(timer);
  }, [refresh]);

  const pass = useMemo(() => passes.find((item) => item.passId === selectedId) || null, [passes, selectedId]);
  const status = pass ? validity(pass) : null;

  async function handleCreated(createdPass) {
    setShowForm(false);
    await refresh();
    setSelectedId(createdPass.passId);
    setNotice('Visit request submitted for approval.');
  }

  return <main className="visitor-shell">
    <header className="visitor-topbar">
      <a className="visitor-brand" href="#" aria-label="SAGE visitor portal"><span className="visitor-brand-mark"><ShieldCheck size={19} /></span><span>SAGE<small>VISITOR PORTAL</small></span></a>
      <div className="visitor-topbar-actions"><span className="visitor-sync"><span className="live-dot" /> STATUS SYNC ON</span><span className="visitor-header-divider" /><span className="visitor-header-user"><span className="visitor-avatar visitor-avatar-small">{guest.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span>{guest.fullName.split(' ')[0]}</span></span><button className="visitor-icon-button" onClick={onLogout} aria-label="Sign out"><LogOut size={17} /></button></div>
    </header>
    <div className="visitor-content">
      <section className="visitor-welcome"><div><span className="eyebrow">PERSONAL ACCESS CONSOLE</span><h1>Your visits, <em>in one place.</em></h1><p>Manage campus visit requests and keep your digital pass ready at the gate.</p></div><button className="visitor-primary-button" onClick={() => setShowForm(!showForm)}>{showForm ? <X size={16} /> : <FilePlus2 size={16} />}{showForm ? 'Close request' : 'Request a visit'}</button></section>
      <div className="visitor-trust-strip"><span><ShieldCheck size={16} /></span><p><strong>One profile. Every visit.</strong> Your verified details are ready whenever you request a new pass.</p><span className="visitor-trust-account"><UserRound size={14} /> {guest.email}</span></div>
      {showForm && <VisitorRequestForm guest={guest} onClose={() => setShowForm(false)} onCreated={handleCreated} />}
      <div className="visitor-section-heading"><div><span className="eyebrow">YOUR ACCESS</span><h2>Visit passes</h2></div><button className="visitor-refresh" onClick={() => refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'refresh-spin' : ''} /> Refresh</button></div>
      {error && <div className="visitor-form-error" role="alert">{error}</div>}
      {loading && !passes.length ? <div className="visitor-loading"><span className="visitor-spinner" /> Loading your passes…</div>
        : passes.length ? <section className="visitor-dashboard">
          <div className="visitor-pass-list-card"><div className="visitor-list-header"><div><span className="eyebrow">PASS HISTORY</span><h3>All your visits</h3></div><span className="visitor-count">{passes.length.toString().padStart(2, '0')}</span></div><div className="visitor-pass-list">{passes.map((item) => <PassCard key={item.passId} pass={item} selected={item.passId === selectedId} onSelect={() => setSelectedId(item.passId)} />)}</div><div className="visitor-list-footer"><span><span className="live-dot" /> Automatically synced</span><span>Every 12 seconds</span></div></div>
          {pass && <article className="visitor-digital-pass">
            <div className="digital-pass-top"><span className="eyebrow">DIGITAL GATE PASS</span><span className={`visitor-status-pill ${status.className}`}><span className="visitor-status-light" />{status.label}</span></div>
            <div className="digital-pass-identity"><span className="visitor-avatar visitor-avatar-large">{guest.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><span>VISITOR</span><h2>{guest.fullName}</h2><small>{guest.affiliation || 'Campus guest'}</small></div></div>
            <div className="digital-pass-code"><div className="digital-reference"><span>REFERENCE ID</span><strong>{pass.referenceId || 'Pending approval'}</strong></div><div className="digital-qr"><QRPass referenceId={pass.referenceId} /><span>SCAN AT THE GATE</span></div></div>
            <div className="digital-pass-details"><div><span><CalendarDays size={13} /> ARRIVAL</span><strong>{formatDate(pass.validFrom, true)}</strong></div><div><span><Clock3 size={13} /> DEPARTURE</span><strong>{formatDate(pass.validUntil, true)}</strong></div><div><span><UserRound size={13} /> HOST</span><strong>{pass.hostDepartment}</strong></div><div><span><Fingerprint size={13} /> PURPOSE</span><strong>{pass.purpose}</strong></div></div>
            {pass.approvalStatus === 'Pending' && <div className="visitor-pending-note"><Clock3 size={15} /><span><strong>With your host for review</strong><small>We’ll update this pass as soon as a decision is made.</small></span></div>}
            {pass.approvalStatus === 'Rejected' && <div className="visitor-rejected-note"><X size={15} /><span><strong>This visit was not approved</strong><small>Contact the host department if you need more information.</small></span></div>}
            {pass.approvalStatus === 'Approved' && status.className === 'upcoming' && <div className="visitor-approved-note"><CheckCircle2 size={15} /><span><strong>You’re approved to visit</strong><small>Show your pass and a government-issued photo ID at the entrance.</small></span></div>}
            {pass.approvalStatus === 'Approved' && status.className === 'active' && <div className="visitor-approved-note"><CheckCircle2 size={15} /><span><strong>Your pass is active</strong><small>Have this code and your photo ID ready for the campus guard.</small></span></div>}
            <div className="digital-pass-bottom"><span><ShieldCheck size={14} /> SAGE VERIFIED ACCESS</span><span>Issued {formatDate(pass.createdAt)}</span></div>
          </article>}
          {pass && <article className="visitor-equipment-card"><div className="visitor-list-header"><div><span className="eyebrow">ITEM REGISTER</span><h3>Registered equipment</h3></div><span className="visitor-count">{pass.assets.length.toString().padStart(2, '0')}</span></div>{pass.assets.length ? <div className="visitor-equipment-list">{pass.assets.map((asset) => <div className="visitor-equipment-row" key={asset.assetId}><span className="visitor-equipment-icon"><Computer size={16} /></span><span><strong>{asset.itemDescription}</strong><small>Serial {asset.serialNumber}</small></span><span className={`visitor-mini-status ${asset.clearanceStatus.toLowerCase()}`}>{asset.clearanceStatus}</span></div>)}</div> : <div className="visitor-empty-equipment"><Computer size={18} /><span>No equipment on this pass.</span></div>}</article>}
        </section> : <section className="visitor-empty-state"><span><QrCode size={24} /></span><h2>No visits yet</h2><p>Request a visit to start your digital pass collection.</p><button className="visitor-primary-button" onClick={() => setShowForm(true)}><Plus size={16} /> Request your first visit</button></section>}
      <footer className="visitor-footer"><span>© 2026 SAGE campus access</span><span><ShieldCheck size={13} /> Your pass is private to your account</span></footer>
    </div>
  </main>;
}
