import React from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';
import RedocApiReference from '@site/src/components/RedocApiReference';

export default function ApiReferencePage() {
  const openApiJsonUrl = useBaseUrl('/openapi.json');

  return (
    <Layout
      title="API Reference"
      description="Auth service OpenAPI Redoc reference"
    >
      <main className="apiReferencePage">
        <header className="apiReferencePage__header">
          <div>
            <h1>API Reference</h1>
            <p>정적 OpenAPI JSON을 기반으로 렌더링되는 Redoc 문서입니다.</p>
          </div>
          <a className="button button--secondary" href={openApiJsonUrl}>
            OpenAPI JSON
          </a>
        </header>
        <RedocApiReference specUrl="/openapi.json" />
      </main>
    </Layout>
  );
}
