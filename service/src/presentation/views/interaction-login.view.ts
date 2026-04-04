// service/src/presentation/views/interaction-login.view.ts

export interface LoginViewParams {
  tenantCode: string;
  uid: string;
  clientId: string;
  error?: string;
}

export function renderLoginView(params: LoginViewParams): string {
  const { tenantCode, uid, clientId, error } = params;
  const errorHtml = error
    ? `<p class="error">${escapeHtml(errorMessage(error))}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>로그인 — ${escapeHtml(tenantCode)}</title>
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
    .subtitle { color: #666; font-size: .875rem; margin-bottom: 28px; }
    label { display: block; font-size: .875rem; color: #444; margin-bottom: 4px; }
    input {
      width: 100%; padding: 10px 12px; border: 1px solid #d9d9d9;
      border-radius: 6px; font-size: .95rem; margin-bottom: 16px;
      transition: border-color .2s;
    }
    input:focus { outline: none; border-color: #4096ff; }
    button {
      width: 100%; padding: 11px; background: #4096ff; color: #fff;
      border: none; border-radius: 6px; font-size: 1rem; cursor: pointer;
      transition: background .2s;
    }
    button:hover { background: #1677ff; }
    .error { color: #ff4d4f; font-size: .875rem; margin-bottom: 16px; }
    .abort { text-align: center; margin-top: 16px; font-size: .8rem; }
    .abort a { color: #999; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>로그인</h1>
    <p class="subtitle">애플리케이션: <strong>${escapeHtml(clientId)}</strong></p>
    ${errorHtml}
    <form method="POST" action="/t/${escapeHtml(tenantCode)}/interaction/${escapeHtml(uid)}/login">
      <label for="username">사용자명</label>
      <input id="username" name="username" type="text" autocomplete="username" required />
      <label for="password">비밀번호</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">로그인</button>
    </form>
    <div class="abort">
      <a href="/t/${escapeHtml(tenantCode)}/interaction/${escapeHtml(uid)}/abort">취소</a>
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

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    invalid_credentials: '아이디 또는 비밀번호가 올바르지 않습니다.',
    tenant_not_found: '테넌트를 찾을 수 없습니다.',
    invalid_state: '잘못된 요청입니다. 다시 시도해 주세요.',
  };
  return messages[code] ?? '오류가 발생했습니다.';
}
