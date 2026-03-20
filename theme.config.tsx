import type { DocsThemeConfig } from 'nextra-theme-docs'

const themeConfig: DocsThemeConfig = {
  logo: (
    <span className="docs-theme-logo-wrap">
      <img src="/docs/images/logo.png" alt="Skillcraft" className="docs-theme-logo" />
    </span>
  ),
  darkMode: false,
  nextThemes: {
    defaultTheme: 'dark',
    forcedTheme: 'dark',
  },
  project: {
    link: 'https://github.com/skillcraft-gg/skillcraft',
  },
  docsRepositoryBase: 'https://github.com/skillcraft-gg/docs/tree/main',
  sidebar: {
    defaultMenuCollapseLevel: 2,
    toggleButton: true,
  },
  footer: {
    text: 'You can build anything with AI. So how do you prove it?',
  },
  head: () => {
    return (
      <>
        <meta name="theme-color" content="#07050d" />
      </>
    )
  },
  search: {
    placeholder: 'Search docs',
  },
}

export default themeConfig
