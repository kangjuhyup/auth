/* global module */
// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  mainSidebar: [
    'intro',
    'document-map',
    {
      type: 'category',
      label: '핵심 개념',
      collapsed: false,
      items: [
        'concepts',
        'concepts/oidc-flow',
        {
          type: 'category',
          label: 'Tenant',
          collapsed: false,
          items: ['concepts/tenant/overview', 'concepts/tenant/policies'],
        },
        {
          type: 'category',
          label: 'Client',
          collapsed: false,
          items: [
            'concepts/client/overview',
            'concepts/client/policies',
            {
              type: 'category',
              label: 'Grant',
              collapsed: false,
              items: [
                'concepts/client/grants/overview',
                'concepts/client/grants/custom',
              ],
            },
            {
              type: 'category',
              label: 'Scope',
              collapsed: false,
              items: [
                'concepts/client/scopes/overview',
                'concepts/client/scopes/custom',
              ],
            },
          ],
        },
        'concepts/mfa',
        'concepts/idp',
      ],
    },
    {
      type: 'category',
      label: '관리자 UI',
      collapsed: false,
      items: [
        'ui/overview',
        'ui/login',
        'ui/tenants',
        'ui/clients',
        'ui/policies',
        'ui/identity-providers',
        'ui/access',
        'ui/consent',
        'ui/audit-log',
        'ui/security',
        'ui/operations',
      ],
    },
    {
      type: 'category',
      label: 'Interaction UI',
      collapsed: false,
      items: ['ui/interaction-ui'],
    },
    {
      type: 'category',
      label: 'API',
      collapsed: false,
      items: ['api/redoc'],
    },
  ],
};

module.exports = sidebars;
