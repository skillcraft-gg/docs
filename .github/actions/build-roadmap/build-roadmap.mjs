import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROADMAP_LABELS = [
  ['roadmap:now', 'now'],
  ['roadmap:next', 'next'],
  ['roadmap:later', 'later'],
  ['roadmap:released', 'released'],
]

const defaultRepository = `skillcraft-gg/${path.basename(process.cwd())}`
const repository = process.env.GITHUB_REPOSITORY || process.env.SKILLCRAFT_ROADMAP_REPOSITORY || defaultRepository
const repo = repository.split('/').pop() || path.basename(process.cwd())
const outputPath = process.env.SKILLCRAFT_ROADMAP_OUTPUT || path.join('meta', 'roadmap.json')
const apiBaseUrl = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/u, '')
const statusByLabel = new Map(ROADMAP_LABELS)

try {
  const issues = await fetchRoadmapIssues(repository)

  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        repo,
        generatedAt: new Date().toISOString(),
        issues,
      },
      null,
      2,
    ) + '\n',
  )
} catch (error) {
  if (process.env.CI === 'true') {
    throw error
  }

  console.warn(`build-roadmap: ${error instanceof Error ? error.message : String(error)}`)
  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        repo,
        generatedAt: new Date().toISOString(),
        issues: [],
      },
      null,
      2,
    ) + '\n',
  )
}

async function fetchRoadmapIssues(repositoryName) {
  const issues = []

  for (let page = 1; ; page += 1) {
    const response = await fetch(`${apiBaseUrl}/repos/${repositoryName}/issues?state=all&per_page=100&page=${page}`, {
      headers: buildHeaders(),
    })

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status} for ${repositoryName} issues`)
    }

    const payload = await response.json()
    if (!Array.isArray(payload) || payload.length === 0) {
      break
    }

    for (const entry of payload) {
      const issue = normalizeIssue(entry)
      if (issue) {
        issues.push(issue)
      }
    }

    if (payload.length < 100) {
      break
    }
  }

  return issues.sort(
    (left, right) =>
      parseTimestamp(right.updatedAt) - parseTimestamp(left.updatedAt)
      || left.status.localeCompare(right.status)
      || left.number - right.number,
  )
}

function buildHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'skillcraft-roadmap-builder',
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function normalizeIssue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const entry = value
  if (entry.pull_request) {
    return null
  }

  const number = Number(entry.number)
  const title = String(entry.title || '').trim()
  const url = String(entry.html_url || '').trim()
  const state = String(entry.state || '').trim().toLowerCase()
  const createdAt = String(entry.created_at || '').trim()
  const updatedAt = String(entry.updated_at || '').trim()
  const closedAt = entry.closed_at ? String(entry.closed_at).trim() : null
  const labels = normalizeLabels(entry.labels)
  const status = getStatus(labels)

  if (!Number.isInteger(number) || number <= 0 || !title || !url || !createdAt || !updatedAt || !status) {
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
    labels: labels.filter((label) => statusByLabel.has(label)),
    status,
  }
}

function normalizeLabels(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim().toLowerCase()
      }

      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return String(entry.name || '').trim().toLowerCase()
      }

      return ''
    })
    .filter(Boolean)
}

function getStatus(labels) {
  for (const [label, status] of ROADMAP_LABELS) {
    if (labels.includes(label)) {
      return status
    }
  }

  return ''
}

function parseTimestamp(value) {
  const parsed = Date.parse(value || '')
  return Number.isNaN(parsed) ? 0 : parsed
}
