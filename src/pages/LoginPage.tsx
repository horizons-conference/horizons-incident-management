import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Shield, Loader2, LogIn } from 'lucide-react';
import { CONFERENCE_NAME, CONFERENCE_SUBTITLE } from '@/lib/constants';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error);
      setLoading(false);
    }
  };

  const fillDemo = (em: string) => {
    setEmail(em);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{CONFERENCE_NAME}</h1>
          <p className="text-sm text-ink-400 mt-1">{CONFERENCE_SUBTITLE}</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="name@horizons2026.ca"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-critical-700 bg-critical-50 border border-critical-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-5 border-t border-ink-100">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">
              Demo Accounts
            </p>
            <div className="space-y-1.5">
              <button
                onClick={() => fillDemo('admin@horizons2026.ca')}
                className="w-full text-left text-xs text-ink-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <span className="font-semibold">Admin</span> — admin@horizons2026.ca
              </button>
              <button
                onClick={() => fillDemo('michael@horizons2026.ca')}
                className="w-full text-left text-xs text-ink-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <span className="font-semibold">Staff</span> — michael@horizons2026.ca
              </button>
            </div>
            <p className="text-xs text-ink-400 mt-2">Password: password123</p>
          </div>
        </div>

        <p className="text-center text-xs text-ink-500 mt-6">
          Authorized personnel only. All activity is logged.
        </p>
      </div>
    </div>
  );
}
