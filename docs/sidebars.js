// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  mainSidebar: [
    'intro',
    {
      type: 'category',
      label: 'UI 사용 가이드',
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
      label: 'API 문서',
      collapsed: false,
      items: ['api/redoc'],
    },
  ],
};

module.exports = sidebars;
