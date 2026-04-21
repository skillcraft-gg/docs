'use client'

import { startTransition, useEffect, useState } from 'react'

import snapshot from '../data/roadmap-snapshot.json'

type RoadmapStatus = 'now' | 'next' | 'later' | 'released'

type RepoRoadmapIssue = {
  number: number
  title: string
  url: string
  state: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
  labels: string[]
  status: RoadmapStatus
}

type DisplayRoadmapIssue = RepoRoadmapIssue & {
  repo: string
}

type RepoRoadmap = {
  repo: string
  generatedAt: string
  issues: RepoRoadmapIssue[]
}

type RoadmapSection = {
  key: RoadmapStatus
  label: string
  issues: DisplayRoadmapIssue[]
}

const ROADMAP_URLS = [
  'https://skillcraft.gg/docs/meta/roadmap.json',
  'https://skillcraft.gg/skillcraft/meta/roadmap.json',
  'https://skillcraft.gg/meta/roadmap.json',
  'https://skillcraft.gg/credential-ledger/meta/roadmap.json',
  'https://skillcraft.gg/skills-registry/meta/roadmap.json',
  'https://skillcraft.gg/whitepaper/meta/roadmap.json',
  'https://skillcraft.gg/brand-toolkit/meta/roadmap.json',
]

const ROADMAP_STATUS_ORDER: RoadmapStatus[] = ['now', 'next', 'later', 'released']

const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
  now: 'Now',
  next: 'Next',
  later: 'Later',
  released: 'Released',
}

const initialPayloads = Array.isArray(snapshot) ? snapshot : []

const getRepoUrl = (repo: string) => `https://github.com/skillcraft-gg/${repo}`

const parseTimestamp = (value: string) => {
  const parsed = Date.parse(value || '')
  return Number.isNaN(parsed) ? 0 : parsed
}

const formatDate = (value: string | null) => {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const normalizeIssue = (value: unknown): RepoRoadmapIssue | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entry = value as Record<string, unknown>
  const number = Number(entry.number)
  const title = String(entry.title || '').trim()
  const url = String(entry.url || '').trim()
  const state = String(entry.state || '').trim().toLowerCase()
  const createdAt = String(entry.createdAt || '').trim()
  const updatedAt = String(entry.updatedAt || '').trim()
  const closedAt = entry.closedAt ? String(entry.closedAt).trim() : null
  const labels = Array.isArray(entry.labels)
    ? entry.labels.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const status = String(entry.status || '').trim().toLowerCase() as RoadmapStatus

  if (!Number.isInteger(number) || number <= 0 || !title || !url || !createdAt || !updatedAt) {
    return null
  }

  if (!ROADMAP_STATUS_ORDER.includes(status)) {
    return null
  }

  return {
    number,
    title,
    url,
    state,
    createdAt,
    updatedAt,
    closedAt,
    labels,
    status,
  }
}

const normalizePayload = (value: unknown): RepoRoadmap | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entry = value as Record<string, unknown>
  const repo = String(entry.repo || '').trim()
  const generatedAt = String(entry.generatedAt || '').trim()
  const issues = Array.isArray(entry.issues)
    ? entry.issues.map(normalizeIssue).filter((item): item is RepoRoadmapIssue => Boolean(item))
    : []

  if (!repo) {
    return null
  }

  return {
    repo,
    generatedAt,
    issues,
  }
}

const buildSections = (payloads: unknown[]): RoadmapSection[] => {
  const issuesByStatus = new Map<RoadmapStatus, DisplayRoadmapIssue[]>()

  for (const status of ROADMAP_STATUS_ORDER) {
    issuesByStatus.set(status, [])
  }

  for (const payload of payloads.map(normalizePayload).filter((item): item is RepoRoadmap => Boolean(item))) {
    for (const issue of payload.issues) {
      issuesByStatus.get(issue.status)?.push({
        ...issue,
        repo: payload.repo,
      })
    }
  }

  return ROADMAP_STATUS_ORDER.map((status) => ({
    key: status,
    label: ROADMAP_STATUS_LABELS[status],
    issues: [...(issuesByStatus.get(status) || [])].sort(
      (left, right) =>
        parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt)
        || left.repo.localeCompare(right.repo)
        || left.number - right.number,
    ),
  })).filter((section) => section.issues.length > 0)
}

const loadLivePayloads = async () => {
  const results = await Promise.allSettled(
    ROADMAP_URLS.map(async (url) => {
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

export default function RoadmapPage() {
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
        setRefreshError('Live roadmap refresh failed. Showing the latest bundled snapshot instead.')
      } finally {
        setIsRefreshing(false)
      }
    }

    void refresh()
  }, [])

  const sections = hasMounted ? buildSections(payloads) : []

  return (
    <div className="docs-roadmap">
      <div className="docs-roadmap-toolbar">
        <div className="docs-roadmap-toolbar-copy">
          {refreshedAt ? <p className="docs-roadmap-meta">Last refreshed: {new Date(refreshedAt).toLocaleString()}</p> : null}
        </div>
        <button
          type="button"
          className="docs-btn docs-btn-secondary docs-roadmap-refresh"
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
              setRefreshError('Live roadmap refresh failed. Showing the latest bundled snapshot instead.')
            } finally {
              setIsRefreshing(false)
            }
          }}
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {refreshError ? <p className="docs-roadmap-warning">{refreshError}</p> : null}

      {!hasMounted ? <p className="docs-roadmap-meta">Loading roadmap...</p> : null}

      {hasMounted && sections.length === 0 ? <p className="docs-roadmap-empty">No roadmap items are available yet.</p> : null}

      {hasMounted && sections.length > 0 ? sections.map((section) => (
        <section key={section.key} id={`roadmap-${section.key}`} className="docs-roadmap-section">
          <h2>{section.label}</h2>
          <ul className="docs-roadmap-list">
            {section.issues.map((issue) => (
              <li key={`${issue.repo}-${issue.number}`} className="docs-roadmap-item">
                <a className="docs-roadmap-issue-link" href={issue.url} target="_blank" rel="noreferrer">
                  {issue.title}
                </a>
                <div className="docs-roadmap-item-meta">
                  <a className="docs-roadmap-repo-link" href={getRepoUrl(issue.repo)} target="_blank" rel="noreferrer">
                    {issue.repo}
                  </a>
                  <span>#{issue.number}</span>
                  <span>Updated {formatDate(issue.updatedAt)}</span>
                  {issue.status === 'released' && issue.closedAt ? <span>Closed {formatDate(issue.closedAt)}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )) : null}
    </div>
  )
}
