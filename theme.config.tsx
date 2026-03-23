import type { DocsThemeConfig } from 'nextra-theme-docs'

const docsMetaTitle = 'Skillcraft: Turn your work into verifiable AI credentials'
const docsMetaDescription =
  'Capture what you build, share your progress, and earn verifiable credentials that prove measurable real-world AI engineering work.'
const docsOgImage = 'https://skillcraft.gg/images/og-home.jpg'
const docsFavicon = 'https://skillcraft.gg/images/skillcraft-icon-zoom.png'

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
  useNextSeoProps() {
    return {
      titleTemplate: `%s | ${docsMetaTitle}`,
      description: docsMetaDescription,
      openGraph: {
        type: 'website',
        siteName: 'Skillcraft',
        description: docsMetaDescription,
        images: [
          {
            url: docsOgImage,
            width: 1200,
            height: 630,
            alt: 'Skillcraft landing preview',
          },
        ],
      },
    }
  },
  head: () => {
    return (
      <>
      <meta name="theme-color" content="#07050d" />
      <link rel="icon" href={docsFavicon} />
      <link rel="shortcut icon" href={docsFavicon} />
      <link rel="apple-touch-icon" href={docsFavicon} />
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:description" content={docsMetaDescription} />
      <meta name="twitter:image" content={docsOgImage} />
      <meta name="twitter:image:alt" content="Skillcraft landing preview" />
      </>
    )
  },
  search: {
    placeholder: 'Search docs',
  },
}

export default themeConfig
