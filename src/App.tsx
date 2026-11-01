import { useEffect } from 'react';
import { Icon } from './components/ui';
import { useUI, setUI, type Tab } from './lib/uiState';
import { useToast, undo, dismissToast, initRemote, loadProblem } from './lib/store';
import Today from './screens/Today';
import Training from './screens/Training';
import Groceries from './screens/Groceries';
import Progress from './screens/Progress';
import Settings from './screens/Settings';
import SessionLogger from './screens/SessionLogger';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'training', label: 'Training', icon: 'training' },
  { id: 'groceries', label: 'Groceries', icon: 'cart' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function App() {
  const { tab, sessionId } = useUI();
  const toast = useToast();
  useEffect(() => { initRemote(); }, []);
  return (
    <>
      <main className="app">
        {loadProblem && (
          <div className="banner warn" role="alert" style={{ marginTop: 12 }}>
            <span>⚠️</span>
            <div className="small grow">Your saved data couldn’t be read, so the app started fresh. The original was kept on this device (key “{loadProblem}”). Restore a backup in Settings → Data & backup, and don’t reset the app.</div>
          </div>
        )}
        {tab === 'today' && <Today />}
        {tab === 'training' && <Training />}
        {tab === 'groceries' && <Groceries />}
        {tab === 'progress' && <Progress />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setUI({ tab: t.id })} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={24} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      {sessionId && <SessionLogger id={sessionId} onClose={() => setUI({ sessionId: null })} />}
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span className="ellipsis">{toast.text}</span>
          {toast.canUndo && <button className="btn sm" onClick={() => { undo(); }}>Undo</button>}
          <button className="icon-btn" style={{ width: 28, height: 28, background: 'transparent' }} onClick={dismissToast} aria-label="Dismiss"><Icon name="x" size={16} /></button>
        </div>
      )}
    </>
  );
}
