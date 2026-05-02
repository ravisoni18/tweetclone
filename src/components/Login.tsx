import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { signInWithGoogle, inviteStatus, pendingUserName, clearInviteStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      // AuthContext.onAuthStateChanged now handles the status check and
      // sets inviteStatus to 'pending' | 'rejected' | 'approved' before
      // ever calling setUser(), so we never race to the home screen.
      await signInWithGoogle();
    } catch (err) {
      console.error('Login failed:', err);
      setError('Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── PENDING SCREEN ──
  if (inviteStatus === 'pending') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />

      <div className="relative max-w-md w-full">
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-32 h-32 bg-blue-500/20 rounded-full blur-xl animate-pulse delay-1000" />

        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-10 shadow-2xl text-center">
          <div className="text-6xl mb-6">📬</div>
          <h2 className="text-2xl font-bold text-white mb-3">You're on the list!</h2>
          <p className="text-gray-300 mb-2">
            Hey <strong className="text-white">{pendingUserName}</strong>, your request has been received.
          </p>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            An admin will review your request and send an approval email to your Google account address.
            Once approved, sign back in with the same Google account.
          </p>
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-6">
            <p className="text-blue-300 text-sm">
              ✉️ Watch for an email from <strong>admin@patr.me</strong>
            </p>
          </div>
          <button
            onClick={clearInviteStatus}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to sign in
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[['🔥','Trending'],['💬','Connect'],['🌟','Discover']].map(([emoji, label]) => (
            <div key={label} className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl mb-1">{emoji}</div>
              <p className="text-xs text-gray-300">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── REJECTED SCREEN ──
  if (inviteStatus === 'rejected') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />

      <div className="relative max-w-md w-full">
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-red-500/10 rounded-full blur-xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-32 h-32 bg-purple-500/10 rounded-full blur-xl animate-pulse delay-1000" />

        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-10 shadow-2xl text-center">
          <div className="text-6xl mb-6">🚫</div>
          <h2 className="text-2xl font-bold text-white mb-3">Access Not Approved</h2>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Your request was not approved at this time. If you believe this is a mistake, please reach out to the admin.
          </p>
          <a
            href="mailto:admin@patr.me"
            className="inline-block bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl text-sm font-medium transition-colors mb-4"
          >
            ✉️ Contact admin@patr.me
          </a>
          <br />
          <button
            onClick={clearInviteStatus}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    </div>
  );

  // ── DEFAULT LOGIN SCREEN ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />

      <div className="relative max-w-md w-full">
        {/* Floating orbs */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-32 h-32 bg-blue-500/20 rounded-full blur-xl animate-pulse delay-1000" />

        {/* Main login card */}
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to Patr</h1>
            <p className="text-gray-300 text-lg">Connect with the world around you</p>

            {/* Invite-only badge */}
            <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
              <span className="text-amber-400 text-xs">🔒</span>
              <span className="text-amber-300 text-xs font-medium">Invite-only access</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full group relative overflow-hidden bg-white text-gray-800 rounded-2xl px-6 py-4 font-medium transition-all duration-300 hover:bg-gray-100 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center justify-center space-x-3">
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span className="text-lg">
                {loading ? 'Checking access...' : 'Continue with Google'}
              </span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          </button>

          {error && (
            <p className="mt-3 text-center text-sm text-red-400">{error}</p>
          )}

          <div className="mt-6 p-3 bg-white/3 border border-white/8 rounded-xl">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              New users are placed in a review queue. You'll receive an email at your Google address once approved.
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              By signing in, you agree to our{' '}
              <a href="#" className="text-purple-400 hover:text-purple-300 transition-colors">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-purple-400 hover:text-purple-300 transition-colors">Privacy Policy</a>
            </p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[['🔥','Trending'],['💬','Connect'],['🌟','Discover']].map(([emoji, label]) => (
            <div key={label} className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-2xl mb-1">{emoji}</div>
              <p className="text-xs text-gray-300">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Login;