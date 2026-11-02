import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  LogIn,
  LogOut,
  CheckCircle,
  User,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import {
  GoogleUser,
  saveGoogleUser,
  signOutGoogleUser,
  parseGisCredential,
  getSavedGoogleClientId
} from '../utils/googleAuth';

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: GoogleUser | null;
  onUserChange: (user: GoogleUser | null) => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange
}) => {
  const [clientId] = useState<string>(() => getSavedGoogleClientId());
  const [customEmail, setCustomEmail] = useState('a22621917@gmail.com');
  const [customName, setCustomName] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const gisButtonRef = useRef<HTMLDivElement>(null);

  // Initialize GIS button if client ID is configured
  useEffect(() => {
    if (!isOpen) return;

    const win = window as any;
    const isRealClientId =
      clientId &&
      clientId.includes('.apps.googleusercontent.com') &&
      !clientId.includes('demo') &&
      !clientId.startsWith('628194465299');

    if (isRealClientId && win.google?.accounts?.id && gisButtonRef.current) {
      try {
        win.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response?.credential) {
              const user = parseGisCredential(response.credential);
              if (user) {
                saveGoogleUser(user);
                onUserChange(user);
                syncRealYouTubeHistory(user);
                onClose();
              }
            }
          },
          auto_select: false
        });

        gisButtonRef.current.innerHTML = '';
        win.google.accounts.id.renderButton(gisButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 280
        });
      } catch (err) {
        console.warn('GIS initialize error:', err);
      }
    }
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const syncRealYouTubeHistory = async (user: GoogleUser) => {
    setIsSyncingHistory(true);
    setSyncSuccessMsg('');
    try {
      const q = new URLSearchParams({ userEmail: user.email });
      if (user.accessToken) q.set('accessToken', user.accessToken);

      const res = await fetch(`/api/youtube/history?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data.items) ? data.items.length : 0;
        setSyncSuccessMsg(`YouTube履歴 (${count}本) を同期しました`);
        window.dispatchEvent(new CustomEvent('zero_youtube_history_synced', { detail: data.items }));
      }
    } catch (e) {
      console.warn('Failed to sync history:', e);
    } finally {
      setIsSyncingHistory(false);
    }
  };

  const handleSignOut = () => {
    signOutGoogleUser();
    onUserChange(null);
  };

  const handleDirectSignInWithEmail = (email: string, name?: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('有効なメールアドレスを入力してください');
      return;
    }

    setIsSigningIn(true);
    setErrorMessage('');

    const defaultName = cleanEmail.split('@')[0];
    const finalName = name?.trim() || customName.trim() || defaultName;
    const picture = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`;

    const user: GoogleUser = {
      id: `google_${Date.now()}`,
      email: cleanEmail,
      name: finalName,
      picture,
      signedInAt: new Date().toISOString()
    };

    setTimeout(async () => {
      saveGoogleUser(user);
      onUserChange(user);
      await syncRealYouTubeHistory(user);
      setIsSigningIn(false);
      onClose();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden text-neutral-900 dark:text-neutral-100 animate-scale-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-700 shadow-xs flex items-center justify-center p-2 shrink-0">
              <svg className="w-full h-full" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-white leading-tight">
                Google アカウントでログイン
              </h2>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                お気に入り動画や視聴履歴をアカウントに保存
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm">
          {/* Current Logged In Status Banner */}
          {currentUser && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-300 dark:border-emerald-800/40 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={currentUser.picture}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-full border-2 border-emerald-500 object-cover shadow-xs shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(currentUser.email)}`;
                  }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-neutral-900 dark:text-white truncate">
                      {currentUser.name}
                    </span>
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate font-mono">
                    {currentUser.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncRealYouTubeHistory(currentUser)}
                  disabled={isSyncingHistory}
                  className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="履歴を再同期"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHistory ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  ログアウト
                </button>
              </div>
            </div>
          )}

          {syncSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-400 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick 1-Click Tile */}
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border-2 border-blue-200 dark:border-blue-900/40 space-y-2">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
              ワンクリックログイン
            </span>
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  a
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-neutral-900 dark:text-white truncate">
                    a22621917@gmail.com
                  </div>
                  <div className="text-[10px] text-neutral-500">Google アカウント</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDirectSignInWithEmail('a22621917@gmail.com', 'a22621917')}
                disabled={isSigningIn}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                <span>ログイン</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* GIS Container (if initialized) */}
          <div ref={gisButtonRef} className="flex justify-center" />

          {/* Enter custom Google email */}
          <div className="p-4 rounded-xl bg-white dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <h4 className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
              別のアカウントでログイン
            </h4>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDirectSignInWithEmail(customEmail, customName);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Google メールアドレス <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => {
                    setCustomEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="your-account@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 focus:border-blue-600 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none shadow-xs font-medium"
                  id="google-email-input"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  表示名 / ニックネーム <span className="text-neutral-400 font-normal">(任意)</span>
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="ニックネーム（未入力時はメールの@前）"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 focus:border-blue-600 rounded-xl text-xs sm:text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none shadow-xs font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={isSigningIn}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98 border border-blue-500"
                id="submit-google-login-btn"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSigningIn ? 'ログイン中...' : 'Google アカウントでログイン'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
