import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const defaultRepository = `skillcraft-gg/${path.basename(process.cwd())}`
const repository = process.env.GITHUB_REPOSITORY || process.env.SKILLCRAFT_CHANGELOG_REPOSITORY || defaultRepository
const branch = process.env.SKILLCRAFT_CHANGELOG_BRANCH || 'main'
const repo = repository.split('/').pop() || path.basename(process.cwd())
const outputPath = process.env.SKILLCRAFT_CHANGELOG_OUTPUT || path.join('meta', 'changelog.json')
const format = '%H%x1f%s%x1f%cI%x1e'

const raw = execFileSync('git', ['log', branch, `--format=${format}`], { encoding: 'utf8' })

const commits = raw
  .split('\x1e')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [sha, message, committedAt] = entry.split('\x1f')

    return {
      sha,
      message,
      url: `https://github.com/${repository}/commit/${sha}`,
      committedAt,
    }
  })
  .filter((entry) => entry.sha && entry.message && entry.committedAt)

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      repo,
      branch,
      generatedAt: new Date().toISOString(),
      commits,
    },
    null,
    2,
  ) + '\n',
)
