import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const outputPath = path.join('data', 'changelog-snapshot.json')
const localDocsPath = path.join('meta', 'changelog.json')

const remoteSources = [
  'https://skillcraft.gg/skillcraft/meta/changelog.json',
  'https://skillcraft.gg/meta/changelog.json',
  'https://skillcraft.gg/credential-ledger/meta/changelog.json',
  'https://skillcraft.gg/skills-registry/meta/changelog.json',
  'https://skillcraft.gg/whitepaper/meta/changelog.json',
  'https://skillcraft.gg/brand-toolkit/meta/changelog.json',
]

const payloads = []

if (existsSync(localDocsPath)) {
  try {
    payloads.push(JSON.parse(readFileSync(localDocsPath, 'utf8')))
  } catch {
    // Keep builds resilient when the local snapshot is temporarily unavailable.
  }
}

for (const url of remoteSources) {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      continue
    }

    payloads.push(await response.json())
  } catch {
    // Live changelog fetch is best-effort during static export.
  }
}

mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(payloads, null, 2) + '\n')
