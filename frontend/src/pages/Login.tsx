import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/app/overview', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-surface p-4 sm:p-6">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[5%] h-[45%] w-[45%] rounded-full bg-primary/10 blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[5%] h-[40%] w-[40%] rounded-full bg-primary/5 blur-[120px]"></div>
      </div>

      <div className="relative w-full max-w-[440px]">
        <div className="mb-12 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <img
              src="/skai-favicon.png"
              alt="Skai"
              className="h-8 w-8 object-contain"
              draggable={false}
            />
          </div>
          <img
            src="/skai-wordmark-white.png"
            alt="Skai"
            className="h-7 w-auto object-contain brightness-0"
            draggable={false}
          />
        </div>

        <div className="glass-panel rounded-xl p-8 shadow-2xl md:p-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 font-medium">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                Email Address
              </label>
              <input
                className="sunken-input w-full"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant ml-1">
                Password
              </label>
              <input
                className="sunken-input w-full"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-white font-headline font-bold py-4 rounded-lg shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
            >
              <span>{submitting ? 'Signing in…' : 'Sign In'}</span>
              {!submitting && <LogIn className="w-5 h-5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
