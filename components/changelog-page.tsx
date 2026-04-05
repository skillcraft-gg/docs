'use client'

import { startTransition, useEffect, useState } from 'react'

import snapshot from '../data/changelog-snapshot.json'

type RepoCommit = {
  sha: string
  message: string
  url: string
  committedAt: string
}

type DisplayCommit = RepoCommit & {
  repo: string
}

type RepoChangelog = {
  repo: string
  branch: string
  generatedAt: string
  commits: RepoCommit[]
}

type DayGroup = {
  key: string
  label: string
  sections: CommitSection[]
}

type CommitSection = {
  key: 'features' | 'fixes' | 'other'
  label: string
  commits: DisplayCommit[]
}

const SECTION_ORDER: CommitSection['key'][] = ['features', 'fixes', 'other']

const SECTION_LABELS: Record<CommitSection['key'], string> = {
  features: 'Features',
  fixes: 'Fixes',
  other: 'Other',
}

const CHANGELOG_URLS = [
  'https://skillcraft.gg/docs/meta/changelog.json',
  'https://skillcraft.gg/skillcraft/meta/changelog.json',
  'https://skillcraft.gg/meta/changelog.json',
  'https://skillcraft.gg/credential-ledger/meta/changelog.json',
  'https://skillcraft.gg/skills-registry/meta/changelog.json',
  'https://skillcraft.gg/whitepaper/meta/changelog.json',
  'https://skillcraft.gg/brand-toolkit/meta/changelog.json',
]

const CONVENTIONAL_COMMIT_PATTERN = /^([a-z]+)(?:\([^)]+\))?!?:\s+/u

const initialPayloads = Array.isArray(snapshot) ? snapshot : []

const getRepoUrl = (repo: string) => `https://github.com/skillcraft-gg/${repo}`

const getCommitType = (message: string) => {
  const match = message.match(CONVENTIONAL_COMMIT_PATTERN)
  return match?.[1]?.toLowerCase() || ''
}

const getCommitSectionKey = (message: string): CommitSection['key'] | null => {
  const type = getCommitType(message)

  if (!type || type === 'chore') {
    return null
  }

  if (type === 'feat') {
    return 'features'
  }

  if (type === 'fix') {
    return 'fixes'
  }

  return 'other'
}

const getDisplayMessage = (message: string) => {
  const stripped = message.replace(CONVENTIONAL_COMMIT_PATTERN, '').trim()
  const base = stripped || message
  const capitalized = base ? `${base[0].toUpperCase()}${base.slice(1)}` : base

  if (!capitalized) {
    return capitalized
  }

  return /[.!?]$/u.test(capitalized) ? capitalized : `${capitalized}.`
}

const parseTimestamp = (value: string) => {
  const parsed = Date.parse(value || '')
  return Number.isNaN(parsed) ? 0 : parsed
}

const normalizeCommit = (value: unknown): RepoCommit | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entry = value as Record<string, unknown>
  const sha = String(entry.sha || '').trim()
  const message = String(entry.message || '').trim()
  const url = String(entry.url || '').trim()
  const committedAt = String(entry.committedAt || '').trim()

  if (!sha || !message || !url || !committedAt) {
    return null
  }

  return {
    sha,
    message,
    url,
    committedAt,
  }
}

const normalizePayload = (value: unknown): RepoChangelog | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entry = value as Record<string, unknown>
  const repo = String(entry.repo || '').trim()
  const branch = String(entry.branch || '').trim()
  const generatedAt = String(entry.generatedAt || '').trim()
  const commits = Array.isArray(entry.commits)
    ? entry.commits.map(normalizeCommit).filter((item): item is RepoCommit => Boolean(item))
    : []

  if (!repo || branch !== 'main') {
    return null
  }

  return {
    repo,
    branch,
    generatedAt,
    commits,
  }
}

const toLocalDayKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const toLocalDayLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

const buildDayGroups = (payloads: unknown[]): DayGroup[] => {
  const days = new Map<string, { label: string; sections: Map<CommitSection['key'], DisplayCommit[]> }>()

  for (const payload of payloads.map(normalizePayload).filter((item): item is RepoChangelog => Boolean(item))) {
    const matchingCommits = payload.commits.filter((commit) => getCommitSectionKey(commit.message) !== null)

    for (const commit of matchingCommits) {
      const commitDate = new Date(commit.committedAt)
      const dayKey = toLocalDayKey(commitDate)
      const sectionKey = getCommitSectionKey(commit.message)

      if (!sectionKey) {
        continue
      }

      const existingDay = days.get(dayKey) || {
        label: toLocalDayLabel(commitDate),
        sections: new Map<CommitSection['key'], DisplayCommit[]>(),
      }

      if (!existingDay.sections.has(sectionKey)) {
        existingDay.sections.set(sectionKey, [])
      }

      existingDay.sections.get(sectionKey)?.push({
        ...commit,
        repo: payload.repo,
      })
      days.set(dayKey, existingDay)
    }
  }

  return Array.from(days.entries())
    .map(([key, day]) => ({
      key,
      label: day.label,
      sections: SECTION_ORDER
        .map((sectionKey) => ({
          key: sectionKey,
          label: SECTION_LABELS[sectionKey],
          commits: [...(day.sections.get(sectionKey) || [])].sort(
            (left, right) =>
              parseTimestamp(right.committedAt) - parseTimestamp(left.committedAt)
              || left.repo.localeCompare(right.repo)
              || left.sha.localeCompare(right.sha),
          ),
        }))
        .filter((section) => section.commits.length > 0),
    }))
    .filter((group) => group.sections.length > 0)
    .sort((left, right) => right.key.localeCompare(left.key))
}

const loadLivePayloads = async () => {
  const results = await Promise.allSettled(
    CHANGELOG_URLS.map(async (url) => {
      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(`failed to fetch ${url}`)
      }

      return response.json()
    }),
  )

  return results
    .filter((result): result is PromiseFulfilledResult<unknown> => result.status === 'fulfilled')
    .map((result) => result.value)
}

export default function ChangelogPage() {
  const [hasMounted, setHasMounted] = useState(false)
  const [payloads, setPayloads] = useState<unknown[]>(initialPayloads)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  useEffect(() => {
    setHasMounted(true)

    const refresh = async () => {
      setIsRefreshing(true)
      setRefreshError(null)

      try {
        const nextPayloads = await loadLivePayloads()

        if (nextPayloads.length > 0) {
          startTransition(() => {
            setPayloads(nextPayloads)
          })
          setRefreshedAt(new Date().toISOString())
        }
      } catch {
        setRefreshError('Live changelog refresh failed. Showing the latest bundled snapshot instead.')
      } finally {
        setIsRefreshing(false)
      }
    }

    void refresh()
  }, [])

  const dayGroups = hasMounted ? buildDayGroups(payloads) : []

  return (
    <div className="docs-changelog">
      <div className="docs-changelog-toolbar">
        {refreshedAt ? (
          <p className="docs-changelog-meta">Last refreshed: {new Date(refreshedAt).toLocaleString()}</p>
        ) : null}
        <button
          type="button"
          className="docs-btn docs-btn-secondary docs-changelog-refresh"
          onClick={async () => {
            setIsRefreshing(true)
            setRefreshError(null)

            try {
              const nextPayloads = await loadLivePayloads()
              if (nextPayloads.length > 0) {
                startTransition(() => {
                  setPayloads(nextPayloads)
                })
                setRefreshedAt(new Date().toISOString())
              }
            } catch {
              setRefreshError('Live changelog refresh failed. Showing the latest bundled snapshot instead.')
            } finally {
              setIsRefreshing(false)
            }
          }}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {refreshError ? <p className="docs-changelog-warning">{refreshError}</p> : null}

      {!hasMounted ? (
        <p className="docs-changelog-meta">Loading changelog...</p>
      ) : null}

      {hasMounted && dayGroups.length === 0 ? (
        <p className="docs-changelog-empty">No changelog entries are available yet.</p>
      ) : null}

      {hasMounted && dayGroups.map((dayGroup) => (
        <section key={dayGroup.key} className="docs-changelog-day">
          <h1>{dayGroup.label}</h1>
          {dayGroup.sections.map((section) => (
            <div key={`${dayGroup.key}-${section.key}`} className="docs-changelog-section">
              <h3>{section.label}</h3>
              <ul className="docs-changelog-list">
                {section.commits.map((commit) => (
                  <li key={`${commit.repo}-${commit.sha}`}>
                    {getDisplayMessage(commit.message)} (
                    <a
                      className="docs-changelog-hash"
                      href={commit.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {commit.sha.slice(0, 7)}
                    </a>{' '}
                    in{' '}
                    <a
                      className="docs-changelog-repo-link"
                      href={getRepoUrl(commit.repo)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {commit.repo}
                    </a>
                    )
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
