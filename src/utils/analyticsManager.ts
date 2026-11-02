/**
 * analyticsManager.ts
 * プライバシー保護型匿名集計・オプトイン管理ユーティリティ
 */

import { GoogleUser } from './googleAuth';

const OPT_IN_STORAGE_KEY = 'zero_analytics_opt_in';

export function getAnalyticsOptIn(): boolean {
  try {
    const val = localStorage.getItem(OPT_IN_STORAGE_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

export function setAnalyticsOptIn(enabled: boolean) {
  try {
    localStorage.setItem(OPT_IN_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('zero_analytics_opt_in_changed', { detail: enabled }));
  } catch {}
}

let cachedAnonToken = '';
export function getOrInitVisitorId(): string {
  if (cachedAnonToken) return cachedAnonToken;
  try {
    let token = sessionStorage.getItem('zero_anon_session_token');
    if (!token) {
      token = 's_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('zero_anon_session_token', token);
    }
    cachedAnonToken = token;
    return token;
  } catch {
    return 's_' + Math.random().toString(36).slice(2, 8);
  }
}

export function recordVisitorAudit(
  _user?: GoogleUser | null,
  action: 'visit' | 'watch' | 'search' | 'sync' | 'logout' | 'active' | 'login' | 'blocked' = 'visit',
  _description?: string,
  detail?: any
) {
  const optIn = getAnalyticsOptIn();
  if (!optIn) return;

  if (action === 'visit' || action === 'active') {
    fetch('/api/analytics/pv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optIn: true })
    }).catch(() => {});
  }

  if (action === 'watch' && detail?.videoId) {
    fetch('/api/analytics/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        optIn: true,
        videoId: detail.videoId,
        title: detail.channel ? `${detail.channel} - 動画` : '動画'
      })
    }).catch(() => {});
  }
}

export function recordGoogleUserAudit(
  _user: GoogleUser,
  _action = 'login',
  _description?: string,
  _detail?: any
) {
  // No-op (Admin tracking removed)
}

export function sendHeartbeat(anonymousToken?: string, _action?: string) {
  const optIn = getAnalyticsOptIn();
  if (!optIn) return;

  const token = anonymousToken || getOrInitVisitorId();
  fetch('/api/analytics/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ optIn: true, anonymousToken: token })
  }).catch(() => {});
}

export function isVisitorBlocked(_ip?: string, _fp?: string, _email?: string): boolean {
  return false;
}
