// Supabase Edge Function: send-email
// Deploy with: supabase functions deploy send-email
//
// Environment variables needed:
//   RESEND_API_KEY  - or SENDGRID_API_KEY
//
// This function accepts a JSON body with:
//   { to, subject, html, type, userId }
//
// and forwards it to the email provider.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'HealthApp <no-reply@healthapp.dev>'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').filter(Boolean)

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get('origin') || ''
  if (ALLOWED_ORIGINS.length === 0) return origin // dev fallback
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT_MAX) return true
  timestamps.push(now)
  rateLimitMap.set(key, timestamps)
  return false
}

serve(async (req: Request) => {
  const corsOrigin = getCorsOrigin(req)
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, type, userId } = await req.json()

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (!EMAIL_REGEX.test(to)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (isRateLimited(to)) {
      return new Response(JSON.stringify({ error: 'Too many requests, please try again later' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ status: 'skipped', message: 'No API key configured' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Send via Resend (swap for SendGrid if preferred)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ status: 'failed', error: 'Email delivery failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    return new Response(
      JSON.stringify({ status: 'delivered', id: data.id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (_err) {
    return new Response(
      JSON.stringify({ status: 'failed', error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
