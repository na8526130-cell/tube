/**
 * YouTube Education Player Engine & Dynamic Parameter Management
 * Self-contained implementation: Communicates strictly with Google endpoints & local server.
 * ZERO third-party servers used.
 */

export interface SpreadsheetEduConfig {
  parameterText: string;
  widgetApiSource: string;
}

export interface EducationStreamResponse {
  url: string;
  videoId?: string;
  param?: string;
}

const EDUCATION_HOST = 'https://www.youtubeeducation.com';
const SPREADSHEET_ID = '1dily2wiik92TAyK3zyIsu8TDuyYNoF20IM1iMk_X-pg';
const SHEET_NAME = 'Youtube-education-parameter';
export const CACHE_KEY = 'kaito_edu_spreadsheet_cache_v3';
const CACHE_TTL = 30 * 60 * 1000; // 30 mins
const WIDGET_SCRIPT_ID = 'youtube-education-widget-api';
export const USER_GESTURE_KEY = 'yt_user_gesture_v1';

// Revoked signatures known to trigger YouTube Education Error 152 - 5
export const REVOKED_EDU_SIGNATURES = [
  'AXH1ezlIo9yTZoatl0F62iZ6Ls3G', // Error 152 - 5 signature
];

export function isRevokedEduSignature(text?: string): boolean {
  if (!text) return true;
  for (const sig of REVOKED_EDU_SIGNATURES) {
    if (text.includes(sig)) return true;
  }
  return false;
}

export function clearEducationCaches(): void {
  try {
    inMemoryConfig = null;
    inMemoryConfigTimestamp = 0;
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('kaito_edu_spreadsheet_cache_v2');
    localStorage.removeItem('kaito_edu_spreadsheet_cache_v1');
  } catch {}
}

// Built-in verified active parameter set (local constant, self-contained)
export const DEFAULT_EDU_PARAMETER =
  '?autoplay=1&mute=0&controls=1&start=0&origin=https%3A%2F%2Fcreate.kahoot.it&playsinline=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&fs=1&cc_load_policy=0&embed_config=%7B%22enc%22%3A%22AXH1ezmt9Ixx8M_GIvnihcbUr3x-Yo-0QgEMBd8Rwhgzn2V6ayVxTkiUA-_evkp7T924lee7qtiFnAvf2fMVFDK30kg7efTA28EoiPZGcipEUqIABP17vm0JKqf_WO5O1ouAyyO53Ach53GT_dJqQA8ZqPhnwk1bJA%3D%3D%22%2C%22hideTitle%22%3Atrue%7D&enablejsapi=1&widgetid=1&forigin=https%3A%2F%2Fcreate.kahoot.it%2Flearner%2Fcb8cb5ae-d835-4c4a-bc2d-9cc78519d646%2Fcourse%2F6fba06e3-1f76-47a8-9a4a-53c53eb86286%2F0&aoriginsup=1&vf=6';

let inMemoryConfig: SpreadsheetEduConfig | null = null;
let inMemoryConfigTimestamp = 0;
let widgetApiPromise: Promise<any> | null = null;

export interface EducationParameterOptions {
  autoplay?: boolean;
  start?: number;
  origin?: string;
  forigin?: string;
}

export function createYoutubeEducationParameters(
  parameterText?: string,
  options: EducationParameterOptions = {}
): URLSearchParams {
  let raw = String(parameterText || DEFAULT_EDU_PARAMETER);
  if (isRevokedEduSignature(raw)) {
    raw = DEFAULT_EDU_PARAMETER;
  }

  const normalizedParameterText = raw
    .trim()
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/gi, '&')
    .replace(/&#x0*26;/gi, '&')
    .replace(/^\?/, '');

  const params = new URLSearchParams(normalizedParameterText);
  params.set('enablejsapi', '1');
  params.set('controls', '1');
  params.set('playsinline', '1');
  params.set('autoplay', options.autoplay === false ? '0' : '1');
  if (typeof options.start === 'number' && options.start > 0) {
    params.set('start', String(Math.floor(options.start)));
  }
  if (!params.has('widgetid')) {
    params.set('widgetid', '1');
  }

  // Preserve cryptographic origin bound to the enc signature (e.g. create.kahoot.it).
  // Only override if explicitly requested in options.origin.
  if (options.origin) {
    params.set('origin', options.origin);
  } else if (!params.has('origin') && typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    params.set('origin', window.location.origin);
  }

  if (options.forigin) {
    params.set('forigin', options.forigin);
  } else if (!params.has('forigin') && typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    params.set('forigin', window.location.href);
  }

  return params;
}

export function normalizeEduParameter(
  rawParam?: string,
  options: EducationParameterOptions = {}
): string {
  const params = createYoutubeEducationParameters(rawParam, options);
  return `?${params.toString()}`;
}

export interface ClassroomEduTokens {
  rct: string;
  enc: string;
  videoId?: string;
  updatedAt?: number;
}

export const CLASSROOM_TOKENS_STORAGE_KEY = 'kaito_classroom_edu_tokens_v1';
export const VIDEO_TOKENS_MAP_KEY = 'kaito_classroom_tokens_by_video_v1';

export function getSavedClassroomEduTokens(videoId?: string): ClassroomEduTokens | null {
  try {
    const cleanId = videoId ? String(videoId).trim() : '';
    if (cleanId) {
      const mapRaw = localStorage.getItem(VIDEO_TOKENS_MAP_KEY);
      if (mapRaw) {
        const map = JSON.parse(mapRaw);
        if (map && map[cleanId]) {
          return map[cleanId];
        }
      }
    }
    const raw = localStorage.getItem(CLASSROOM_TOKENS_STORAGE_KEY);
    if (!raw) return null;
    const globalToken: ClassroomEduTokens = JSON.parse(raw);
    if (cleanId && globalToken.videoId && globalToken.videoId !== cleanId) {
      return null;
    }
    return globalToken;
  } catch {
    return null;
  }
}

export function saveClassroomEduTokens(tokens: ClassroomEduTokens): void {
  try {
    const enriched = {
      ...tokens,
      updatedAt: Date.now()
    };
    localStorage.setItem(CLASSROOM_TOKENS_STORAGE_KEY, JSON.stringify(enriched));
    if (tokens.videoId) {
      let map: Record<string, ClassroomEduTokens> = {};
      try {
        const rawMap = localStorage.getItem(VIDEO_TOKENS_MAP_KEY);
        if (rawMap) map = JSON.parse(rawMap);
      } catch {}
      map[tokens.videoId] = enriched;
      localStorage.setItem(VIDEO_TOKENS_MAP_KEY, JSON.stringify(map));
    }
    window.dispatchEvent(new CustomEvent('kaito_classroom_tokens_updated', { detail: enriched }));
  } catch {}
}

export function clearClassroomEduTokens(videoId?: string): void {
  try {
    if (videoId) {
      try {
        const rawMap = localStorage.getItem(VIDEO_TOKENS_MAP_KEY);
        if (rawMap) {
          const map = JSON.parse(rawMap);
          delete map[videoId];
          localStorage.setItem(VIDEO_TOKENS_MAP_KEY, JSON.stringify(map));
        }
      } catch {}
    } else {
      localStorage.removeItem(CLASSROOM_TOKENS_STORAGE_KEY);
      localStorage.removeItem(VIDEO_TOKENS_MAP_KEY);
    }
    window.dispatchEvent(new CustomEvent('kaito_classroom_tokens_updated', { detail: null }));
  } catch {}
}

/**
 * 3. YouTube Education URL の構築 (Google Classroom 準拠)
 *
 * function createYouTubeEducationUrl({ videoId, rct, enc }) {
 *   const embedConfig = {
 *     hideInfoBar: false,
 *     disableRelatedVideos: true,
 *     enc
 *   };
 *   const params = new URLSearchParams({
 *     enablejsapi: "1",
 *     rel: "0",
 *     rct,
 *     embed_config: JSON.stringify(embedConfig)
 *   });
 *   return (
 *     `https://www.youtubeeducation.com/embed/` +
 *     `${encodeURIComponent(videoId)}?${params.toString()}`
 *   );
 * }
 */
export function createYouTubeEducationUrl({
  videoId,
  rct,
  enc
}: {
  videoId: string;
  rct: string;
  enc: string;
}): string {
  const embedConfig = {
    hideInfoBar: false,
    disableRelatedVideos: true,
    enc
  };

  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    rct,
    embed_config: JSON.stringify(embedConfig)
  });

  return `${EDUCATION_HOST}/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export const createClassroomEducationUrl = createYouTubeEducationUrl;

/**
 * Google Classroom batchexecute (RPC ID: DKRBLb) レスポンスの解析
 * 添付ドキュメントのアルゴリズムに100%準拠
 */
export function parseDKRBLbResponse(text: string): {
  videoId: string;
  rct: string;
  enc: string;
  rawPayload?: any;
} {
  let clean = String(text || '').trim();

  // 1. youtubeeducation.com 埋め込みURLの直接入力に対応
  if (clean.includes('youtubeeducation.com/embed/')) {
    try {
      const parsedUrl = new URL(clean);
      const parts = parsedUrl.pathname.split('/');
      const extractedVideoId = decodeURIComponent(parts[parts.length - 1] || '').split('?')[0];
      const rct = parsedUrl.searchParams.get('rct') || '';
      let enc = '';
      const rawCfg = parsedUrl.searchParams.get('embed_config');
      if (rawCfg) {
        try {
          const cfg = JSON.parse(rawCfg);
          enc = cfg.enc || '';
        } catch {}
      }
      if (extractedVideoId && rct && enc) {
        return { videoId: extractedVideoId, rct, enc, rawPayload: { url: clean } };
      }
    } catch {}
  }

  // 2. ドキュメント記載のアルゴリズム: )]}' ヘッダーを除去
  clean = clean.replace(/^\)\]\}'\s*/, '');

  const lines = clean
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    // データサイズ行を無視 (/^\d+$/)
    if (/^\d+$/.test(line)) {
      continue;
    }

    let chunk: any;
    try {
      chunk = JSON.parse(line);
    } catch {
      continue;
    }

    if (!Array.isArray(chunk)) continue;

    for (const item of chunk) {
      if (
        Array.isArray(item) &&
        item[0] === 'wrb.fr' &&
        item[1] === 'DKRBLb'
      ) {
        const payload = typeof item[2] === 'string' ? JSON.parse(item[2]) : item[2];
        if (Array.isArray(payload)) {
          const videoId = payload[0] || '';
          const rct = (payload[1] && payload[1][0]) || '';
          const enc = payload[3] || '';
          return { videoId, rct, enc, rawPayload: payload };
        }
      }
    }
  }

  // 3. 単体配列形式 [videoId, [rct], 2, enc, ...] を直接入力された場合にも対応
  try {
    const direct = JSON.parse(clean);
    if (Array.isArray(direct) && direct.length >= 4) {
      return {
        videoId: direct[0] || '',
        rct: (direct[1] && direct[1][0]) || '',
        enc: direct[3] || '',
        rawPayload: direct
      };
    }
  } catch {}

  throw new Error('Google Classroom の DKRBLb レスポンス形式（wrb.fr / DKRBLb）が見つかりませんでした。Network タブの batchexecute?rpcids=DKRBLb の Response を貼り付けてください。');
}

export function createYoutubeEducationEmbedUrl(
  videoId: string,
  parameterText?: string,
  options: EducationParameterOptions = {}
): string {
  const cleanId = String(videoId || '').trim();
  if (!cleanId) return '';

  const savedTokens = getSavedClassroomEduTokens(cleanId);
  if (savedTokens?.rct && savedTokens?.enc) {
    return createYouTubeEducationUrl({
      videoId: cleanId,
      rct: savedTokens.rct,
      enc: savedTokens.enc
    });
  }

  // Pure YouTube Education embed URL with active cryptographic parameters
  const params = createYoutubeEducationParameters(parameterText || DEFAULT_EDU_PARAMETER, options);
  return `${EDUCATION_HOST}/embed/${encodeURIComponent(cleanId)}?${params.toString()}`;
}

export function configureYoutubeEducationEmbedUrl(
  url: string,
  options: EducationParameterOptions = {}
): string {
  try {
    const parsed = new URL(url);
    parsed.search = createYoutubeEducationParameters(parsed.search, options).toString();
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * 1. Fetch YouTube Education Embed URL from Backend API or generate directly
 */
export async function fetchEducationStreamUrl(videoId: string): Promise<string> {
  const cleanId = String(videoId || '').trim();
  if (!cleanId || cleanId.length !== 11) {
    throw new Error('videoId must be an 11-character YouTube video ID');
  }

  // Try backend endpoint first
  try {
    const res = await fetch(`/api/stream/youtubeeducation/${encodeURIComponent(cleanId)}?origin=kaitotube`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      const streamUrl = typeof data === 'string' ? data : data?.url;
      if (typeof streamUrl === 'string' && streamUrl.trim()) {
        return configureYoutubeEducationEmbedUrl(streamUrl);
      }
    }
  } catch (err) {
    // Expected on static host without local backend
  }

  // Fallback: build embed URL using saved tokens or clean base education embed
  const saved = createYoutubeEducationEmbedUrl(cleanId);
  if (saved) return saved;
  return `https://www.youtubeeducation.com/embed/${encodeURIComponent(cleanId)}?enablejsapi=1&rel=0`;
}

/**
 * Parse Google Spreadsheet gviz JSON response
 */
function parseGvizResponse(text: string): any {
  const prefix = 'google.visualization.Query.setResponse(';
  const startIndex = text.indexOf(prefix);
  const endIndex = text.lastIndexOf(');');
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error('スプレッドシートのレスポンス形式が不正です');
  }
  const jsonString = text.slice(startIndex + prefix.length, endIndex);
  return JSON.parse(jsonString);
}

/**
 * 2. Fetch dynamic parameters and Player API code from Google Spreadsheet (gviz range A1:A2)
 * Falls back safely to verified Kahoot parameters if spreadsheet is inaccessible
 */
export async function fetchSpreadsheetEducationConfig(forceRefresh = false): Promise<SpreadsheetEduConfig> {
  const now = Date.now();

  // Check in-memory cache
  if (!forceRefresh && inMemoryConfig && now - inMemoryConfigTimestamp < CACHE_TTL) {
    return inMemoryConfig;
  }

  // Check localStorage cache
  if (!forceRefresh) {
    try {
      const cachedStr = localStorage.getItem(CACHE_KEY);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (
          parsed &&
          parsed.timestamp &&
          now - parsed.timestamp < CACHE_TTL &&
          parsed.config?.parameterText &&
          !isRevokedEduSignature(parsed.config.parameterText)
        ) {
          inMemoryConfig = parsed.config;
          inMemoryConfigTimestamp = parsed.timestamp;
          return inMemoryConfig!;
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch {}
  }

  // 1. Try local verified backend endpoint first (/api/education-param)
  try {
    const res = await fetch(`/api/education-param?force=${forceRefresh ? 'true' : 'false'}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.param && !isRevokedEduSignature(data.param)) {
        const result: SpreadsheetEduConfig = {
          parameterText: data.param,
          widgetApiSource: data.widgetApiSource || ''
        };
        inMemoryConfig = result;
        inMemoryConfigTimestamp = now;
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ config: result, timestamp: now })
          );
        } catch {}
        return result;
      }
    }
  } catch {}

  // 2. Fetch directly from Google Spreadsheet Visualization API as secondary
  try {
    const params = new URLSearchParams({
      tqx: 'out:json',
      sheet: SHEET_NAME,
      range: 'A1:A2',
      headers: '0'
    });
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${params.toString()}`;
    const res = await fetch(url);
    if (res.ok) {
      const rawText = await res.text();
      const gviz = parseGvizResponse(rawText);

      const row0Value = gviz?.table?.rows?.[0]?.c?.[0]?.v;
      const row1Value = gviz?.table?.rows?.[1]?.c?.[0]?.v;

      let paramText = typeof row0Value === 'string' && row0Value.trim() ? row0Value.trim() : '';
      if (!paramText || isRevokedEduSignature(paramText)) {
        paramText = DEFAULT_EDU_PARAMETER;
      }
      const widgetApi = typeof row1Value === 'string' ? row1Value.trim() : '';

      const result: SpreadsheetEduConfig = {
        parameterText: paramText,
        widgetApiSource: widgetApi
      };

      inMemoryConfig = result;
      inMemoryConfigTimestamp = now;

      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            config: result,
            timestamp: now
          })
        );
      } catch {}

      return result;
    }
  } catch (err: any) {
    console.warn('[EducationEngine] Spreadsheet fetch warning:', err.message);
  }

  // 3. Built-in verified fallback
  const finalFallback: SpreadsheetEduConfig = {
    parameterText: DEFAULT_EDU_PARAMETER,
    widgetApiSource: inMemoryConfig?.widgetApiSource || ''
  };
  return finalFallback;
}

/**
 * 3. Dynamic injection of YouTube IFrame Player API (widgetApiSource) into <head>
 * Reference: ensureYoutubeEducationPlayerApi in ajgpw/siatube
 */
export function injectEducationPlayerApi(widgetApiSource?: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));

  const win = window as any;

  if (win.YT && typeof win.YT.Player === 'function') {
    return Promise.resolve(win.YT);
  }

  if (widgetApiPromise) {
    return widgetApiPromise;
  }

  widgetApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    let pollInterval: number | null = null;
    let timeoutTimer: number | null = null;

    const cleanup = () => {
      if (pollInterval !== null) {
        window.clearInterval(pollInterval);
        pollInterval = null;
      }
      if (timeoutTimer !== null) {
        window.clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    const finish = () => {
      if (settled || !win.YT || typeof win.YT.Player !== 'function') {
        return false;
      }
      settled = true;
      cleanup();
      resolve(win.YT);
      return true;
    };

    const previousReadyCallback = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = (...args: any[]) => {
      if (typeof previousReadyCallback === 'function') {
        try {
          previousReadyCallback(...args);
        } catch {}
      }
      finish();
    };

    pollInterval = window.setInterval(finish, 50);

    timeoutTimer = window.setTimeout(() => {
      if (finish()) return;
      settled = true;
      cleanup();
      document.getElementById(WIDGET_SCRIPT_ID)?.remove();
      reject(new Error('IFrame Player APIの初期化がタイムアウトしました'));
    }, 5000);

    let scriptTag = document.getElementById(WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = WIDGET_SCRIPT_ID;
      if (typeof widgetApiSource === 'string' && widgetApiSource.trim()) {
        scriptTag.textContent = widgetApiSource;
      } else {
        scriptTag.src = 'https://www.youtube.com/iframe_api';
      }
      document.head.appendChild(scriptTag);
    }

    finish();
  }).catch((error) => {
    widgetApiPromise = null;
    throw error;
  });

  return widgetApiPromise;
}

/**
 * 4. Bind window.YT.Player to the rendered iframe element
 */
export interface PlayerBindOptions {
  onReady?: (player: any) => void;
  onPlaying?: () => void;
  onEnded?: () => void;
  onError?: (errCode: number) => void;
  onStateChange?: (state: number) => void;
}

export function bindEducationPlayer(
  iframeElement: HTMLIFrameElement,
  options: PlayerBindOptions = {}
): any {
  const win = window as any;
  if (!win.YT || typeof win.YT.Player !== 'function') {
    console.warn('[EducationEngine] window.YT.Player is not initialized yet');
    return null;
  }

  try {
    const player = new win.YT.Player(iframeElement, {
      events: {
        onReady: (event: any) => {
          options.onReady?.(event.target);
        },
        onStateChange: (event: any) => {
          options.onStateChange?.(event.data);
          // State: 1 = PLAYING, 5 = CUED, 0 = ENDED
          if (event.data === 1) {
            options.onPlaying?.();
          } else if (event.data === 0) {
            options.onEnded?.();
          }
        },
        onError: (event: any) => {
          console.warn('YouTube Education Player API error:', event.data);
          options.onError?.(event.data);
        }
      }
    });
    return player;
  } catch (err) {
    console.warn('[EducationEngine] Failed to bind YT.Player:', err);
    return null;
  }
}

/**
 * 5. Google Classroom 自動取得スクリプト生成（Classroomタブで1クリック実行）
 */
export function generateClassroomBookmarklet(origin: string): string {
  const code = `javascript:(function(){var v=prompt("Classroom Eduトークンを取得したいYouTube動画IDまたはURL:");if(!v)return;var id=v.match(/([a-zA-Z0-9_-]{11})/)?.[1]||v;fetch("https://classroom.google.com/_/ClassroomUi/data/batchexecute?rpcids=DKRBLb",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:"f.req="+encodeURIComponent(JSON.stringify([[["DKRBLb",JSON.stringify([id]),null,"1"]]]))}).then(function(r){return r.text();}).then(function(t){var m=t.match(/\\["wrb\\.fr","DKRBLb","(\\[.*?\\])"/);if(m){var p=JSON.parse(m[1].replace(/\\\\"/g,'"'));var rct=p[1][0],enc=p[3];var u="${origin}/watch?v="+id+"&edu_rct="+encodeURIComponent(rct)+"&edu_enc="+encodeURIComponent(enc);if(confirm("Classroomからトークンを取得しました！ZERO-tubeで開きますか？")){window.open(u,"_blank");}else{prompt("生成されたEdu埋め込みURL:", "https://www.youtubeeducation.com/embed/"+id+"?enablejsapi=1&rel=0&rct="+encodeURIComponent(rct)+"&embed_config="+encodeURIComponent(JSON.stringify({hideInfoBar:false,disableRelatedVideos:true,enc:enc})));}}else{prompt("取得したレスポンス:", t);}}).catch(function(e){alert("Classroomにログインしたタブで実行してください: "+e.message);});})();`;
  return code;
}

export function generateClassroomConsoleSnippet(videoId: string): string {
  return `fetch("https://classroom.google.com/_/ClassroomUi/data/batchexecute?rpcids=DKRBLb", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
  body: "f.req=" + encodeURIComponent(JSON.stringify([[["DKRBLb", JSON.stringify(["${videoId}"]), null, "1"]]]))
}).then(r => r.text()).then(t => {
  console.log("=== DKRBLb レスポンス ===");
  console.log(t);
  const m = t.match(/\\["wrb\\.fr","DKRBLb","(\\[.*?\\])"/);
  if (m) {
    const p = JSON.parse(m[1].replace(/\\\\"/g, '"'));
    console.log("動画ID:", p[0]);
    console.log("rct:", p[1][0]);
    console.log("enc:", p[3]);
    const eduUrl = "https://www.youtubeeducation.com/embed/" + p[0] + "?enablejsapi=1&rel=0&rct=" + encodeURIComponent(p[1][0]) + "&embed_config=" + encodeURIComponent(JSON.stringify({ hideInfoBar: false, disableRelatedVideos: true, enc: p[3] }));
    console.log("🎯 生成された YouTube Education URL:");
    console.log(eduUrl);
  }
});`;
}
