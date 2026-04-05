'use client'

import { startTransition, useEffect, useState } from 'react'

import snapshot from '../data/changelog-snapshot.json'

type RepoCommit = {
  sha: string
  message: string
  url: string
  committedAt: string
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
  commits: RepoCommit[]
}

type RepoGroup = {
  repo: string
  latestTimestamp: number
  days: DayGroup[]
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

const CONVENTIONAL_COMMIT_PATTERN = /^[a-z]+(?:\([^)]+\))?!?:\s+/u

const initialPayloads = Array.isArray(snapshot) ? snapshot : []

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

const buildRepoGroups = (payloads: unknown[]): RepoGroup[] => {
  const repos = new Map<string, RepoCommit[]>()

  for (const payload of payloads.map(normalizePayload).filter((item): item is RepoChangelog => Boolean(item))) {
    const matchingCommits = payload.commits.filter((commit) => CONVENTIONAL_COMMIT_PATTERN.test(commit.message))
    if (!repos.has(payload.repo)) {
      repos.set(payload.repo, [])
    }

    repos.get(payload.repo)?.push(...matchingCommits)
  }

  return Array.from(repos.entries())
    .map(([repo, commits]) => {
      const sortedCommits = [...commits].sort((left, right) => parseTimestamp(right.committedAt) - parseTimestamp(left.committedAt))
      const dayGroups = new Map<string, DayGroup>()

      for (const commit of sortedCommits) {
        const commitDate = new Date(commit.committedAt)
        const key = toLocalDayKey(commitDate)
        const existing = dayGroups.get(key)

        if (existing) {
          existing.commits.push(commit)
          continue
        }

        dayGroups.set(key, {
          key,
          label: toLocalDayLabel(commitDate),
          commits: [commit],
        })
      }

      const days = Array.from(dayGroups.values())
        .map((group) => ({
          ...group,
          commits: [...group.commits].sort((left, right) => parseTimestamp(right.committedAt) - parseTimestamp(left.committedAt)),
        }))
        .sort((left, right) => right.key.localeCompare(left.key))

      return {
        repo,
        latestTimestamp: sortedCommits.length ? parseTimestamp(sortedCommits[0].committedAt) : 0,
        days,
      }
    })
    .filter((group) => group.days.length > 0)
    .sort((left, right) => right.latestTimestamp - left.latestTimestamp)
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
  const [payloads, setPayloads] = useState<unknown[]>(initialPayloads)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  useEffect(() => {
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
          return
        }

        setRefreshError('No live changelog sources responded.')
      } catch {
        setRefreshError('Live changelog refresh failed. Showing the latest bundled snapshot instead.')
      } finally {
        setIsRefreshing(false)
      }
    }

    void refresh()
  }, [])

  const repoGroups = buildRepoGroups(payloads)

  return (
    <div className="docs-changelog">
      <div className="docs-changelog-toolbar">
        <p className="docs-changelog-meta">
          Rendered from `main` branch commits that follow conventional prefixes like `feat:`, `fix:`, `chore:`, and `docs:`.
        </p>
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
              } else {
                setRefreshError('No live changelog sources responded.')
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

      {refreshedAt ? (
        <p className="docs-changelog-meta">Last refreshed: {new Date(refreshedAt).toLocaleString()}</p>
      ) : null}

      {refreshError ? <p className="docs-changelog-warning">{refreshError}</p> : null}

      {repoGroups.length === 0 ? (
        <p className="docs-changelog-empty">No changelog entries are available yet.</p>
      ) : null}

      {repoGroups.map((repoGroup) => (
        <section key={repoGroup.repo} className="docs-changelog-repo">
          <h2>{repoGroup.repo}</h2>
          {repoGroup.days.map((dayGroup) => (
            <div key={`${repoGroup.repo}-${dayGroup.key}`} className="docs-changelog-day">
              <h3>{dayGroup.label}</h3>
              <ul className="docs-changelog-list">
                {dayGroup.commits.map((commit) => (
                  <li key={commit.sha}>
                    {commit.message} (
                    <a
                      className="docs-changelog-hash"
                      href={commit.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {commit.sha.slice(0, 7)}
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
