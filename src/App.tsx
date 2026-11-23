import {useCallback, useEffect, useMemo, useState} from 'react';
import {fetchPortalState, getAuthStatus} from './api';
import {HistoryView} from './components/HistoryView';
import {InventoryWorkspace} from './components/InventoryWorkspace';
import {LoginPage} from './components/LoginPage';
import type {AuthStatusResponse, PortalState} from './types';

type ActiveTab = 'inventory' | 'history';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [adminLogin, setAdminLogin] = useState<string>('');
  const [portalState, setPortalState] = useState<PortalState | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');

  const refreshAuthStatus = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const status = await getAuthStatus();
      setAuthStatus(status);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to reach PRMSC server.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthStatus();
  }, [refreshAuthStatus]);

  useEffect(() => {
    if (!sessionToken) {
      setPortalState(null);
      return;
    }
    let cancelled = false;
    setPortalLoading(true);
    fetchPortalState(sessionToken)
      .then((data) => {
        if (!cancelled) {
          setPortalState(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPortalLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const summary = useMemo(() => {
    if (!portalState) {
      return {total: 0, issued: 0, available: 0, activeHolders: 0};
    }
    const total = portalState.items.reduce((acc, it) => acc + it.totalQuantity, 0);
    const issued = portalState.items.reduce((acc, it) => acc + it.issuedQuantity, 0);
    const available = total - issued;
    const activeHolders = portalState.issuances.filter(
      (r) => r.quantity - r.returnedQuantity > 0,
    ).length;
    return {total, issued, available, activeHolders};
  }, [portalState]);

  function handleSignOut() {
    setSessionToken(null);
    setAdminLogin('');
    setPortalState(null);
    setActiveTab('inventory');
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-base font-semibold text-[#111917]">PRMSC</p>
          <p className="mt-1 text-sm text-[#52635E]">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (authError || !authStatus) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-xl border border-[#DCE4E0] bg-white p-6 text-center">
          <p className="text-base font-semibold text-[#111917]">Connection Error</p>
          <p className="mt-2 text-sm text-[#52635E]">
            {authError ?? 'Unable to load portal status.'}
          </p>
          <button
            type="button"
            onClick={() => void refreshAuthStatus()}
            className="mt-4 px-4 py-2 rounded-lg bg-[#145346] text-white text-sm font-medium hover:bg-[#0E3F35] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!sessionToken) {
    return (
      <LoginPage
        authStatus={authStatus}
        onSetupComplete={() => void refreshAuthStatus()}
        onLoginSuccess={(token, login) => {
          setSessionToken(token);
          setAdminLogin(login);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8F7] flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#DCE4E0]">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className="text-lg font-bold tracking-tight text-[#111917] whitespace-nowrap shrink-0"
          >
            PRMSC
          </button>

          <nav className="flex items-center gap-6" aria-label="Primary navigation">
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`py-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'inventory'
                  ? 'border-[#145346] text-[#111917]'
                  : 'border-transparent text-[#52635E] hover:text-[#111917]'
              }`}
            >
              Inventory &amp; Issue
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'history'
                  ? 'border-[#145346] text-[#111917]'
                  : 'border-transparent text-[#52635E] hover:text-[#111917]'
              }`}
            >
              Issuance History
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleSignOut}
              className="px-4 py-2 rounded-lg border border-[#DCE4E0] bg-white text-xs font-medium text-[#1F2D29] hover:bg-[#F6F8F7] transition-colors whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Institutional Context & Live Summary Strip */}
      <div className="bg-white border-b border-[#EDF2EF]">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-[#111917]">
              Punjab Rural Municipal Services Company
            </h1>
            <p className="text-xs text-[#52635E] mt-0.5">
              IT Asset Registry · Signed in as {adminLogin || 'Administrator'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 lg:gap-10">
            <div>
              <p className="text-xs text-[#64746F]">Total Stock</p>
              <p className="font-mono text-lg font-semibold text-[#111917] tabular-nums">
                {summary.total}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64746F]">Issued Out</p>
              <p className="font-mono text-lg font-semibold text-[#52635E] tabular-nums">
                {summary.issued}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64746F]">Available</p>
              <p className="font-mono text-lg font-semibold text-[#145346] tabular-nums">
                {summary.available}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64746F]">Active Issuances</p>
              <p className="font-mono text-lg font-semibold text-[#111917] tabular-nums">
                {summary.activeHolders}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">
        {portalLoading || !portalState ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-44 rounded-xl border border-[#DCE4E0] bg-white p-5 animate-pulse"
              />
            ))}
          </div>
        ) : activeTab === 'inventory' ? (
          <InventoryWorkspace
            token={sessionToken}
            state={portalState}
            onStateChange={setPortalState}
            onOpenHistory={() => setActiveTab('history')}
          />
        ) : (
          <HistoryView
            state={portalState}
            onBackToInventory={() => setActiveTab('inventory')}
          />
        )}
      </main>
    </div>
  );
}
