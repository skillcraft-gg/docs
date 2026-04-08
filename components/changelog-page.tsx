'use client'

import { startTransition, useEffect, useState } from 'react'

import snapshot from '../data/changelog-snapshot.json'

type RepoCommit = {
  sha: string
  message: string
  url: string
  committedAt: string
  tags: string[]
  unreleased: boolean
}

type DisplayCommit = RepoCommit & {
  repo: string
}

type CommitReference = DisplayCommit

type RenderCommit =
  | {
      kind: 'release'
      commit: DisplayCommit
    }
  | {
      kind: 'commit'
      message: string
      references: CommitReference[]
      unreleased: boolean
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
  sections: CommitSection[]
}

type CommitSection = {
  key: 'releases' | 'features' | 'fixes' | 'other'
  label: string
  commits: RenderCommit[]
}

const SECTION_ORDER: CommitSection['key'][] = ['releases', 'features', 'fixes', 'other']

const SECTION_LABELS: Record<CommitSection['key'], string> = {
  releases: 'Releases',
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
const RELEASE_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/
const RELEASE_MESSAGE_PATTERN = /^chore(?:\([^)]+\))?:\s+release\s+v\d+\.\d+\.\d+$/u

const initialPayloads = Array.isArray(snapshot) ? snapshot : []

const getRepoUrl = (repo: string) => `https://github.com/skillcraft-gg/${repo}`
const getTagUrl = (repo: string, tag: string) => `${getRepoUrl(repo)}/tree/${tag}`
const getNpmVersionUrl = (tag: string) => `https://www.npmjs.com/package/skillcraft/v/${tag.replace(/^v/, '')}`

const getCommitType = (message: string) => {
  const match = message.match(CONVENTIONAL_COMMIT_PATTERN)
  return match?.[1]?.toLowerCase() || ''
}

const isReleaseCommit = (commit: RepoCommit) => !!getPrimaryReleaseTag(commit) || RELEASE_MESSAGE_PATTERN.test(commit.message)

const getCommitSectionKey = (commit: RepoCommit): CommitSection['key'] | null => {
  if (isReleaseCommit(commit)) {
    return 'releases'
  }

  const message = commit.message
  const type = getCommitType(message)

  if (!type) {
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

const getPrimaryReleaseTag = (commit: RepoCommit) => {
  const releaseTags = commit.tags.filter((tag) => RELEASE_TAG_PATTERN.test(tag))
  return releaseTags[releaseTags.length - 1] || ''
}

const getReleaseSeriesKey = (tag: string) => {
  const match = tag.match(RELEASE_TAG_PATTERN)
  if (!match) {
    return ''
  }

  return `${match[1]}.${match[2]}`
}

const compareReleaseTags = (left: string, right: string) => {
  const leftMatch = left.match(RELEASE_TAG_PATTERN)
  const rightMatch = right.match(RELEASE_TAG_PATTERN)
  if (!leftMatch || !rightMatch) {
    return left.localeCompare(right, undefined, { numeric: true })
  }

  const leftParts = leftMatch.slice(1).map((value) => Number(value))
  const rightParts = rightMatch.slice(1).map((value) => Number(value))
  for (let index = 0; index < leftParts.length; index += 1) {
    const diff = leftParts[index] - rightParts[index]
    if (diff !== 0) {
      return diff
    }
  }

  return 0
}

const dedupeReleaseCommits = (commits: DisplayCommit[], dayKey: string) => {
  const deduped = new Map<string, DisplayCommit>()

  for (const commit of commits) {
    const tag = getPrimaryReleaseTag(commit)
    const series = getReleaseSeriesKey(tag)
    if (!tag || !series) {
      deduped.set(`${commit.repo}:${commit.sha}`, commit)
      continue
    }

    const key = `${commit.repo}:${dayKey}:${series}`
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, commit)
      continue
    }

    const existingTag = getPrimaryReleaseTag(existing)
    const tagComparison = compareReleaseTags(tag, existingTag)
    if (tagComparison > 0 || (tagComparison === 0 && parseTimestamp(commit.committedAt) > parseTimestamp(existing.committedAt))) {
      deduped.set(key, commit)
    }
  }

  return Array.from(deduped.values())
}

const collapseCommitRows = (commits: DisplayCommit[]) => {
  const grouped = new Map<string, { message: string; references: CommitReference[]; committedAt: string; unreleased: boolean }>()

  for (const commit of commits) {
    const message = getDisplayMessage(commit.message)
    const key = message.toLowerCase()
    const existing = grouped.get(key)
    if (!existing) {
      grouped.set(key, {
        message,
        references: [commit],
        committedAt: commit.committedAt,
        unreleased: commit.unreleased,
      })
      continue
    }

    existing.references.push(commit)
    if (parseTimestamp(commit.committedAt) > parseTimestamp(existing.committedAt)) {
      existing.committedAt = commit.committedAt
    }
    existing.unreleased = existing.unreleased || commit.unreleased
  }

  return Array.from(grouped.values())
    .map((entry) => ({
      kind: 'commit' as const,
      message: entry.message,
      references: entry.references.sort(
        (left, right) => left.repo.localeCompare(right.repo) || left.sha.localeCompare(right.sha),
      ),
      unreleased: entry.unreleased,
      committedAt: entry.committedAt,
    }))
    .sort(
      (left, right) =>
        parseTimestamp(right.committedAt) - parseTimestamp(left.committedAt)
        || left.message.localeCompare(right.message),
    )
}

const markUnreleasedCommits = (repo: string, commits: RepoCommit[]) => {
  if (repo !== 'skillcraft') {
    return commits.map((commit) => ({ ...commit, unreleased: false }))
  }

  let seenRelease = false
  return commits.map((commit) => {
    const isRelease = !!getPrimaryReleaseTag(commit)
    const unreleased = !seenRelease && !isRelease
    if (isRelease) {
      seenRelease = true
    }

    return {
      ...commit,
      unreleased,
    }
  })
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
  const tags = Array.isArray(entry.tags)
    ? entry.tags
      .map((value) => String(value || '').trim())
      .filter(Boolean)
    : []

  if (!sha || !message || !url || !committedAt) {
    return null
  }

  return {
    sha,
    message,
    url,
    committedAt,
    tags,
    unreleased: false,
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
  const rawCommits = Array.isArray(entry.commits)
    ? entry.commits.map(normalizeCommit).filter((item): item is RepoCommit => Boolean(item))
    : []
  const commits = markUnreleasedCommits(repo, rawCommits)

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
    const matchingCommits = payload.commits.filter((commit) => getCommitSectionKey(commit) !== null)

    for (const commit of matchingCommits) {
      const commitDate = new Date(commit.committedAt)
      const dayKey = toLocalDayKey(commitDate)
      const sectionKey = getCommitSectionKey(commit)

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
        .map((sectionKey) => {
          const commits = [...(day.sections.get(sectionKey) || [])].sort(
            (left, right) =>
              parseTimestamp(right.committedAt) - parseTimestamp(left.committedAt)
              || left.repo.localeCompare(right.repo)
              || left.sha.localeCompare(right.sha),
          )

          return {
            key: sectionKey,
            label: SECTION_LABELS[sectionKey],
            commits:
              sectionKey === 'releases'
                ? dedupeReleaseCommits(commits, key).map((commit) => ({ kind: 'release' as const, commit }))
                : collapseCommitRows(commits),
          }
        })
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
        <div className="docs-changelog-toolbar-copy">
          {refreshedAt ? (
            <p className="docs-changelog-meta">Last refreshed: {new Date(refreshedAt).toLocaleString()}</p>
          ) : null}
          <p className="docs-changelog-meta docs-changelog-note">
            <span className="docs-changelog-unreleased">*</span>
            {' '}indicates changes not yet released.
          </p>
        </div>
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

      {hasMounted && dayGroups.length > 0 ? dayGroups.map((dayGroup) => (
        <section key={dayGroup.key} id={dayGroup.key} className="docs-changelog-day">
          <h2>{dayGroup.label}</h2>
          {dayGroup.sections.map((section) => (
            <div key={`${dayGroup.key}-${section.key}`} className="docs-changelog-section">
              <h3>{section.label}</h3>
              <ul className="docs-changelog-list">
                {section.commits.map((commit) => (
                  <li
                    key={
                      commit.kind === 'release'
                        ? `${commit.commit.repo}-${commit.commit.sha}`
                        : `${commit.message}-${commit.references.map((reference) => `${reference.repo}-${reference.sha}`).join('-')}`
                    }
                  >
                    {commit.kind === 'release' ? (
                      <span className="docs-changelog-release">
                        <a
                          className="docs-changelog-repo-link"
                          href={getRepoUrl(commit.commit.repo)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {commit.commit.repo}
                        </a>{' '}
                        release{' '}
                        {commit.commit.tags.map((tag, index) => (
                          <span key={`${commit.commit.repo}-${commit.commit.sha}-${tag}`}>
                            {index > 0 ? ', ' : null}
                            <a
                              className="docs-changelog-tag"
                              href={getTagUrl(commit.commit.repo, tag)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {tag}
                            </a>
                          </span>
                        ))}
                        {commit.commit.repo === 'skillcraft' && getPrimaryReleaseTag(commit.commit) ? (
                          <a
                            className="docs-changelog-npm-link"
                            href={getNpmVersionUrl(getPrimaryReleaseTag(commit.commit))}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="docs-changelog-npm-icon" aria-hidden="true">
                              <NpmLogo />
                            </span>
                            View on npm
                          </a>
                        ) : null}
                      </span>
                    ) : (
                      <>
                        {commit.message} (
                        {commit.references.map((reference, index) => (
                          <span key={`${reference.repo}-${reference.sha}`}>
                            {index > 0 ? ', ' : null}
                            <a
                              className="docs-changelog-hash"
                              href={reference.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {reference.sha.slice(0, 7)}
                            </a>{' '}
                            in{' '}
                            <a
                              className="docs-changelog-repo-link"
                              href={getRepoUrl(reference.repo)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {reference.repo}
                            </a>
                          </span>
                        ))}
                        )
                        {commit.unreleased ? <span className="docs-changelog-unreleased">*</span> : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )) : null}
    </div>
  )
}

const NpmLogo = () => (
  <svg viewBox="0 0 18 7" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path fill="#CB3837" d="M0,0h18v6H9v1H5V6H0V0z M1,5h2V2h1v3h1V1H1V5z M6,1v5h2V5h2V1H6z M8,2h1v2H8V2z M11,1v4h2V2h1v3h1V2h1v3h1V1H11z" />
    <polygon fill="#FFFFFF" points="1,5 3,5 3,2 4,2 4,5 5,5 5,1 1,1 " />
    <path fill="#FFFFFF" d="M6,1v5h2V5h2V1H6z M9,4H8V2h1V4z" />
    <polygon fill="#FFFFFF" points="11,1 11,5 13,5 13,2 14,2 14,5 15,5 15,2 16,2 16,5 17,5 17,1 " />
  </svg>
)
