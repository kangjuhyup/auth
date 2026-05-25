import React, { useEffect, useRef, useState } from 'react';

const REDOC_SCRIPT_SRC =
  'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';

let redocScriptPromise;

function loadRedocScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.Redoc) {
    return Promise.resolve();
  }
  if (!redocScriptPromise) {
    redocScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = REDOC_SCRIPT_SRC;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Redoc script load failed'));
      document.body.appendChild(script);
    });
  }
  return redocScriptPromise;
}

export default function RedocApiReference({
  specUrl = 'http://localhost:3000/openapi.json',
}) {
  const containerRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function renderRedoc() {
      try {
        setErrorMessage('');
        await loadRedocScript();
        if (cancelled || !containerRef.current || !window.Redoc) {
          return;
        }
        containerRef.current.innerHTML = '';
        window.Redoc.init(specUrl, { hideDownloadButton: false }, containerRef.current);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Redoc initialization failed',
          );
        }
      }
    }

    renderRedoc();

    return () => {
      cancelled = true;
    };
  }, [specUrl]);

  return (
    <div className="redocApiReference">
      {errorMessage ? (
        <div className="redocApiReference__error">
          Redoc을 불러오지 못했습니다. service가 실행 중인지, 그리고
          HTTP_CORS_ORIGINS에 docs origin이 포함되어 있는지 확인하세요.
          <br />
          <code>{errorMessage}</code>
        </div>
      ) : null}
      <div ref={containerRef} className="redocApiReference__container" />
    </div>
  );
}
