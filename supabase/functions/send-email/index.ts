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

serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { to, subject, html, type, userId } = await req.json()

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set - skipping actual send')
      return new Response(
        JSON.stringify({ status: 'skipped', message: 'No API key configured' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
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
      console.error('Resend error:', data)
      return new Response(
        JSON.stringify({ status: 'failed', error: data }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ status: 'delivered', id: data.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-email error:', err)
    return new Response(
      JSON.stringify({ status: 'failed', error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
