import {AlertCircle, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {loginAdmin, setupAdminCredentials} from '../api';
import type {AuthStatusResponse} from '../types';

interface LoginPageProps {
  authStatus: AuthStatusResponse;
  onSetupComplete: () => void;
  onLoginSuccess: (token: string, login: string) => void;
}

export function LoginPage({authStatus, onSetupComplete, onLoginSuccess}: LoginPageProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const isSetupMode = authStatus.setupRequired;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedLogin = login.trim();
    if (!trimmedLogin || !password) {
      setError('Please enter both your login ID and password.');
      return;
    }

    if (isSetupMode) {
      if (password.length < 4) {
        setError('Password must be at least 4 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter carefully.');
        return;
      }
      setSubmitting(true);
      try {
        await setupAdminCredentials(trimmedLogin, password);
        setPassword('');
        setConfirmPassword('');
        setNotice(
          'Portal administrator credentials activated. Enter your login ID and password below to proceed.',
        );
        onSetupComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to save administrator credentials.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const result = await loginAdmin(trimmedLogin, password);
      onLoginSuccess(result.token, result.login);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Incorrect login ID or password. You will remain on this page until valid credentials are entered.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8F7] grid grid-cols-1 lg:grid-cols-2 items-stretch">
      {/* Left Institutional Panel */}
      <div className="relative hidden lg:flex flex-col justify-end overflow-hidden bg-[#14362E]">
        {!imageFailed ? (
          <img
            src="/src/assets/images/prmsc_office_hero_1795451751853.jpg"
            alt="Punjab Rural Municipal Services Company workspace"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#145346] via-[#10382F] to-[#0B221D]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1F1A]/90 via-[#0A1F1A]/40 to-transparent" />

        <div className="relative z-10 p-12 max-w-xl text-white">
          <p className="text-xs font-medium tracking-wider uppercase text-emerald-100/80 mb-3">
            Authorized Personnel Portal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight leading-tight text-balance mb-4">
            Punjab Rural Municipal Services Company
          </h1>
          <p className="text-sm leading-relaxed text-emerald-50/85">
            Centralized hardware inventory registry for issuing company laptops and desktops to
            PRMSC employees and tracking asset returns with full accountability.
          </p>
        </div>
      </div>

      {/* Right Authentication Column */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-white border-l border-[#E2E8E5]">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-2.5 text-[#145346] mb-6">
              <ShieldCheck className="w-6 h-6 shrink-0" aria-hidden="true" />
              <span className="text-xl font-bold tracking-tight text-[#111917]">PRMSC</span>
            </div>

            <p className="text-xs font-medium text-[#52635E] mb-1.5">
              Punjab Rural Municipal Services Company
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-[#111917] text-balance">
              {isSetupMode ? 'Create Administrator Credentials' : 'Portal Sign In'}
            </h2>
            <p className="mt-2 text-sm text-[#52635E] leading-relaxed">
              {isSetupMode
                ? 'Set the administrator login ID and password to protect access to the PRMSC hardware inventory.'
                : 'Enter your administrator login ID and password to access hardware stock, employee issuance, and history.'}
            </p>
          </div>

          {notice && (
            <div
              role="status"
              className="mb-6 flex items-start gap-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3.5 text-sm text-[#166534]"
            >
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-sm text-[#991B1B]"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="prmsc-login"
                className="block text-sm font-medium text-[#1F2D29] mb-1.5"
              >
                Login ID
              </label>
              <input
                id="prmsc-login"
                name="login"
                type="text"
                autoComplete="username"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Enter administrator login ID"
                className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] px-3.5 py-2.5 text-sm text-[#111917] placeholder:text-[#869690] focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="prmsc-password"
                className="block text-sm font-medium text-[#1F2D29] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="prmsc-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSetupMode ? 'Create a secure password' : 'Enter your password'}
                  className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] pl-3.5 pr-11 py-2.5 text-sm text-[#111917] placeholder:text-[#869690] focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#52635E] hover:text-[#111917] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#145346]"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {isSetupMode && (
              <div>
                <label
                  htmlFor="prmsc-confirm-password"
                  className="block text-sm font-medium text-[#1F2D29] mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="prmsc-confirm-password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password to confirm"
                  className="w-full rounded-lg border border-[#D1DCD7] bg-[#FBFDFC] px-3.5 py-2.5 text-sm text-[#111917] placeholder:text-[#869690] focus:border-[#145346] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#145346]/15 transition-colors"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#145346] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0E3F35] disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#145346] focus-visible:ring-offset-2"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>
                {submitting
                  ? 'Verifying...'
                  : isSetupMode
                    ? 'Save Credentials & Continue'
                    : 'Sign In'}
              </span>
            </button>
          </form>

          <p className="mt-8 pt-6 border-t border-[#E2E8E5] text-xs text-[#64746F] leading-relaxed">
            Access is restricted to authorized PRMSC staff. Incorrect credentials will keep this
            gate locked.
          </p>
        </div>
      </div>
    </div>
  );
}
