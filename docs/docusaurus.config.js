/* global require, module */
// @ts-check

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Auth Docs',
  tagline: 'OIDC Authorization Server 운영 문서',
  favicon: 'img/auth-docs.svg',

  url: 'https://kangjuhyup.github.io',
  baseUrl: '/auth/',

  organizationName: 'kangjuhyup',
  projectName: 'auth',

  onBrokenLinks: 'throw',
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    localeConfigs: {
      ko: {
        label: '한국어',
      },
      en: {
        label: 'English',
      },
    },
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

  themes: ['@docusaurus/theme-mermaid'],

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
          {
            type: 'localeDropdown',
            position: 'right',
          },
          {
            to: '/api-reference',
            position: 'left',
            label: 'API Reference',
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
