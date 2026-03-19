import { Inter, JetBrains_Mono } from 'next/font/google'
import type { AppProps } from 'next/app'

import 'nextra-theme-docs/style.css'
import '../styles/site.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetBrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} ${jetBrains.variable}`}>
      <Component {...pageProps} />
    </div>
  )
}
