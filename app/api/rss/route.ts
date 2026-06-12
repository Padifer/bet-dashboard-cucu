import { NextResponse } from 'next/server'

interface FeedConfig {
  id: string
  name: string
  url: string
  color: string
}

const FEEDS: FeedConfig[] = [
  { id: 'betfair',     name: 'Betfair Football', url: 'https://betting.betfair.com/football/index.xml',                color: '#f5a623' },
  { id: 'soccerwidow', name: 'Soccerwidow',      url: 'https://www.soccerwidow.com/category/football-gambling/feed/',  color: '#4f8ef7' },
  { id: 'paddypower',  name: 'Paddy Power',      url: 'https://news.paddypower.com/football/feed/',                    color: '#00a859' },
  { id: 'colossus',    name: 'Colossus Bets',    url: 'https://colossusbets.com/blog/feed/',                           color: '#9c5cf7' },
]

const MAX_PER_FEED = 6
const DESC_MAX = 180

export interface RssItem {
  title: string
  link: string
  pubDate: string
  description: string
  source: string
  sourceColor: string
}

interface RssResponse {
  items: RssItem[]
  count: number
  feedsOk: number
  feedsFailed: number
}

// --- Decoders ---------------------------------------------------------------

function decodeEntities(input: string): string {
  if (!input) return ''
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const n = parseInt(hex, 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : ''
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const n = parseInt(dec, 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : ''
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
}

function stripCdata(value: string): string {
  if (!value) return ''
  // <![CDATA[ ... ]]> may appear (possibly multiple), strip wrappers
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function stripHtml(value: string): string {
  if (!value) return ''
  // Remove tags, collapse whitespace
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clamp(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max - 1).trimEnd() + '…'
}

// --- Tag extraction ---------------------------------------------------------

function extractTag(itemXml: string, tag: string): string {
  // Match either <tag>...</tag> or <tag attr="...">...</tag>; case-insensitive
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
  const m = re.exec(itemXml)
  if (!m) return ''
  return m[1] ?? ''
}

function extractLink(itemXml: string): string {
  // Plain RSS: <link>https://...</link>
  const plain = /<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i.exec(itemXml)
  if (plain && plain[1] && plain[1].trim()) {
    return decodeEntities(stripCdata(plain[1]).trim())
  }
  // Atom-style self-closing: <link href="..." />
  const atom = /<link\s[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(itemXml)
  if (atom && atom[1]) return decodeEntities(atom[1])
  return ''
}

function cleanText(raw: string): string {
  return decodeEntities(stripHtml(stripCdata(raw))).trim()
}

function normalizeDate(raw: string): string {
  if (!raw) return ''
  const cleaned = decodeEntities(stripCdata(raw)).trim()
  if (!cleaned) return ''
  const d = new Date(cleaned)
  if (!Number.isFinite(d.getTime())) return cleaned
  return d.toISOString()
}

// --- Per-feed parsing -------------------------------------------------------

function parseFeed(xml: string, feed: FeedConfig): RssItem[] {
  const items: RssItem[] = []
  // RSS uses <item>, Atom uses <entry>
  const itemRe = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = itemRe.exec(xml)) !== null) {
    if (items.length >= MAX_PER_FEED) break
    const block = match[2] ?? ''
    const title = cleanText(extractTag(block, 'title'))
    const link = extractLink(block)
    const pubRaw = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated') || extractTag(block, 'dc:date')
    const pubDate = normalizeDate(pubRaw)
    const descRaw = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content:encoded') || extractTag(block, 'content')
    const description = clamp(cleanText(descRaw), DESC_MAX)
    if (!title || !link) continue
    items.push({
      title,
      link,
      pubDate,
      description,
      source: feed.name,
      sourceColor: feed.color,
    })
  }
  return items
}

// --- Fetcher ---------------------------------------------------------------

async function fetchFeed(feed: FeedConfig): Promise<RssItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      next: { revalidate: 3600 },
      headers: {
        'User-Agent': 'BetTrackerRSS/1.0 (+https://example.local)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    return parseFeed(text, feed)
  } finally {
    clearTimeout(timer)
  }
}

// --- Route handler ----------------------------------------------------------

export const revalidate = 3600

export async function GET(): Promise<NextResponse<RssResponse>> {
  const settled = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)))
  let feedsOk = 0
  let feedsFailed = 0
  const items: RssItem[] = []
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      feedsOk++
      items.push(...result.value)
    } else {
      feedsFailed++
    }
  }
  items.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : 0
    const tb = b.pubDate ? Date.parse(b.pubDate) : 0
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0)
  })
  return NextResponse.json({ items, count: items.length, feedsOk, feedsFailed })
}
