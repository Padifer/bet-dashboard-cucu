import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface NotifyBody {
  message: string
}

export async function POST(req: NextRequest) {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    return NextResponse.json({ ok: false, reason: 'no_config' }, { status: 503 })
  }

  const body = (await req.json()) as NotifyBody
  if (!body.message?.trim()) {
    return NextResponse.json({ ok: false, reason: 'empty_message' }, { status: 400 })
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: body.message, parse_mode: 'HTML' }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ ok: false, reason: err }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
