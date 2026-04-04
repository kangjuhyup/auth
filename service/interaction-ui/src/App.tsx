import { useEffect, useState } from 'react';
import { getDetails } from './api/client';
import type { InteractionDetails } from './api/client';
import LoginPage from './pages/LoginPage';
import MfaPage from './pages/MfaPage';
import ConsentPage from './pages/ConsentPage';
import ErrorPage from './pages/ErrorPage';
import LoadingPage from './pages/LoadingPage';

type Page = 'loading' | 'login' | 'mfa' | 'consent' | 'error';

export default function App() {
  const [page, setPage] = useState<Page>('loading');
  const [details, setDetails] = useState<InteractionDetails | null>(null);
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getDetails()
      .then((d) => {
        setDetails(d);
        if (d.prompt === 'login') {
          setPage('login');
        } else if (d.prompt === 'consent') {
          setPage('consent');
        } else {
          setErrorMsg(`지원하지 않는 인터랙션: ${d.prompt}`);
          setPage('error');
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || '인터랙션 정보를 불러올 수 없습니다.');
        setPage('error');
      });
  }, []);

  const handleLoginSuccess = (result: {
    mfaRequired: boolean;
    methods?: string[];
    redirectTo?: string;
  }) => {
    if (result.mfaRequired && result.methods?.length) {
      setMfaMethods(result.methods);
      setPage('mfa');
    } else if (result.redirectTo) {
      window.location.href = result.redirectTo;
    }
  };

  const handleMfaSuccess = (redirectTo: string) => {
    window.location.href = redirectTo;
  };

  const handleConsentSuccess = (redirectTo: string) => {
    window.location.href = redirectTo;
  };

  const handleError = (msg: string) => {
    setErrorMsg(msg);
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
