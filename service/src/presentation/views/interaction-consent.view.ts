// service/src/presentation/views/interaction-consent.view.ts

export interface ConsentViewParams {
  tenantCode: string;
  uid: string;
  clientId: string;
  missingScopes: string[];
}

export function renderConsentView(params: ConsentViewParams): string {
  const { tenantCode, uid, clientId, missingScopes } = params;
  const scopeList = missingScopes.map((s) => `<li>${escapeHtml(s)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>권한 동의 — ${escapeHtml(tenantCode)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 16px rgba(0,0,0,.1);
      padding: 40px 36px;
      width: 100%;
      max-width: 400px;
    }
    h1 { font-size: 1.4rem; color: #1a1a2e; margin-bottom: 8px; }
    .subtitle { color: #666; font-size: .875rem; margin-bottom: 20px; }
    ul { list-style: disc; padding-left: 20px; margin-bottom: 24px; color: #333; font-size: .9rem; }
    li { margin-bottom: 6px; }
    .actions { display: flex; gap: 12px; }
    button {
      flex: 1; padding: 11px; border: none; border-radius: 6px;
      font-size: 1rem; cursor: pointer; transition: background .2s;
    }
    .allow { background: #4096ff; color: #fff; }
    .allow:hover { background: #1677ff; }
    .deny { background: #f5f5f5; color: #444; }
    .deny:hover { background: #e8e8e8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>권한 동의</h1>
    <p class="subtitle"><strong>${escapeHtml(clientId)}</strong> 앱이 다음 권한을 요청합니다:</p>
    <ul>${scopeList || '<li>기본 정보</li>'}</ul>
    <div class="actions">
      <form method="POST" action="/t/${escapeHtml(tenantCode)}/interaction/${escapeHtml(uid)}/consent" style="flex:1">
        <button type="submit" class="allow">허용</button>
      </form>
      <form method="GET" action="/t/${escapeHtml(tenantCode)}/interaction/${escapeHtml(uid)}/abort" style="flex:1">
        <button type="submit" class="deny">거부</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
