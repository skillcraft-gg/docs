import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

type ChangelogDateLink = {
  id: string
  label: string
}

export default function ChangelogTocExtra() {
  const router = useRouter()
  const [items, setItems] = useState<ChangelogDateLink[]>([])
  const routePath = String(router.asPath || '').split(/[?#]/)[0]
  const isChangelogPage = /(?:^|\/)changelog\/?$/.test(routePath)

  useEffect(() => {
    if (!isChangelogPage) {
      setItems([])
      return
    }

    const updateItems = () => {
      const nextItems = Array.from(document.querySelectorAll<HTMLElement>('.docs-changelog-day[id] > h2'))
        .map((heading) => ({
          id: heading.parentElement?.id || '',
          label: String(heading.textContent || '').trim(),
        }))
        .filter((item) => item.id && item.label)
      setItems(nextItems)
    }

    updateItems()

    const observer = new MutationObserver(updateItems)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [isChangelogPage])

  if (!isChangelogPage || items.length === 0) {
    return null
  }

  return (
    <div
      className="nx-mb-3 nx-pb-3"
      style={{ order: -1 }}
    >
      <p className="nx-mb-4 nx-font-semibold nx-tracking-tight">Dates</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className="nx-my-2 nx-scroll-my-6 nx-scroll-py-6">
            <a
              href={`#${item.id}`}
              className="nx-inline-block nx-w-full nx-break-words nx-text-gray-500 hover:nx-text-gray-900 dark:nx-text-gray-400 dark:hover:nx-text-gray-300 contrast-more:nx-text-gray-900 contrast-more:nx-underline contrast-more:dark:nx-text-gray-50"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <hr className="nx-mt-4 nx-border-neutral-200 dark:nx-border-neutral-800 contrast-more:nx-border-neutral-400" />
    </div>
  )
}
