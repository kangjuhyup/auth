import { useEffect, useState } from 'react';
import { getDetails } from './api/client';
import type { InteractionDetails } from './api/client';
import LoginPage from './pages/LoginPage';
import MfaPage from './pages/MfaPage';
import ConsentPage from './pages/ConsentPage';
import ErrorPage from './pages/ErrorPage';
import LoadingPage from './pages/LoadingPage';
import MfaEnrollmentPage from './pages/MfaEnrollmentPage';
import PasswordChangePage from './pages/PasswordChangePage';
import { debugInteraction } from './lib/debug';

type Page =
  | 'loading'
  | 'login'
  | 'password-change'
  | 'mfa-enrollment'
  | 'mfa'
  | 'consent'
  | 'error';

export default function App() {
  const [page, setPage] = useState<Page>('loading');
  const [details, setDetails] = useState<InteractionDetails | null>(null);
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getDetails()
      .then((d) => {
        debugInteraction('details.loaded', {
          prompt: d.prompt,
          clientId: d.clientId,
          mfaRequired: d.mfaRequired,
          idpCount: d.idpList.length,
          missingScopeCount: d.missingScopes.length,
        });
        setDetails(d);
        if (d.prompt === 'login') {
          debugInteraction('page.transition', {
            from: 'loading',
            to: 'login',
            reason: 'prompt_login',
          });
          setPage('login');
        } else if (d.prompt === 'consent') {
          debugInteraction('page.transition', {
            from: 'loading',
            to: 'consent',
            reason: 'prompt_consent',
          });
          setPage('consent');
        } else {
          setErrorMsg(`지원하지 않는 인터랙션: ${d.prompt}`);
          debugInteraction('page.transition', {
            from: 'loading',
            to: 'error',
            reason: 'unsupported_prompt',
          });
          setPage('error');
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || '인터랙션 정보를 불러올 수 없습니다.');
        debugInteraction('page.transition', {
          from: 'loading',
          to: 'error',
          reason: 'details_failed',
        });
        setPage('error');
      });
  }, []);

  const handleLoginSuccess = (result: {
    mfaRequired?: boolean;
    mfaEnrollmentRequired?: boolean;
    methods?: string[];
    passwordChangeRequired?: boolean;
    redirectTo?: string;
  }) => {
    debugInteraction('login.result', {
      success: true,
      passwordChangeRequired: result.passwordChangeRequired === true,
      mfaRequired: result.mfaRequired === true,
      mfaEnrollmentRequired: result.mfaEnrollmentRequired === true,
      methodCount: result.methods?.length ?? 0,
      hasRedirect: Boolean(result.redirectTo),
    });
    if (result.passwordChangeRequired) {
      debugInteraction('page.transition', {
        from: 'login',
        to: 'password-change',
        reason: 'password_change_required',
      });
      setPage('password-change');
    } else if (result.mfaEnrollmentRequired) {
      setMfaMethods(result.methods ?? ['totp']);
      debugInteraction('page.transition', {
        from: 'login',
        to: 'mfa-enrollment',
        reason: 'mfa_enrollment_required',
      });
      setPage('mfa-enrollment');
    } else if (result.mfaRequired && result.methods?.length) {
      setMfaMethods(result.methods);
      debugInteraction('page.transition', {
        from: 'login',
        to: 'mfa',
        reason: 'mfa_required',
      });
      setPage('mfa');
    } else if (result.redirectTo) {
      debugInteraction('redirect', {
        reason: 'login_completed',
        hasRedirect: true,
      });
      window.location.href = result.redirectTo;
    }
  };

  const handleMfaSuccess = (redirectTo: string) => {
    debugInteraction('redirect', {
      reason: 'mfa_completed',
      hasRedirect: Boolean(redirectTo),
    });
    window.location.href = redirectTo;
  };

  const handleConsentSuccess = (redirectTo: string) => {
    debugInteraction('redirect', {
      reason: 'consent_completed',
      hasRedirect: Boolean(redirectTo),
    });
    window.location.href = redirectTo;
  };

  const handleError = (msg: string) => {
    setErrorMsg(msg);
    debugInteraction('page.transition', {
      to: 'error',
      reason: 'ui_error',
    });
    setPage('error');
  };

  switch (page) {
    case 'loading':
      return <LoadingPage />;
    case 'login':
      return (
        <LoginPage
          details={details!}
          onSuccess={handleLoginSuccess}
          onError={handleError}
        />
      );
    case 'password-change':
      return <PasswordChangePage onSuccess={handleLoginSuccess} />;
    case 'mfa-enrollment':
      return (
        <MfaEnrollmentPage onSuccess={handleMfaSuccess} onError={handleError} />
      );
    case 'mfa':
      return (
        <MfaPage
          methods={mfaMethods}
          onSuccess={handleMfaSuccess}
          onError={handleError}
        />
      );
    case 'consent':
      return (
        <ConsentPage
          details={details!}
          onSuccess={handleConsentSuccess}
          onError={handleError}
        />
      );
    case 'error':
      return <ErrorPage message={errorMsg} />;
  }
}
