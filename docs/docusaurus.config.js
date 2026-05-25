// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Auth Docs',
  tagline: 'OIDC Authorization Server 운영 문서',
  favicon: 'img/auth-docs.svg',

  url: 'https://auth.local',
  baseUrl: '/',

  organizationName: 'auth',
  projectName: 'auth',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Auth Docs',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'mainSidebar',
            position: 'left',
            label: '문서',
          },
        ],
      },
      footer: {
        style: 'light',
        copyright: `Copyright © ${new Date().getFullYear()} Auth.`,
      },
      prism: {
        additionalLanguages: ['bash', 'json'],
      },
    }),
};

module.exports = config;
