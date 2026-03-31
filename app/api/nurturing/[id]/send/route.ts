/**
 * POST /api/nurturing/[id]/send — envia a mensagem sugerida via WhatsApp ou email
 * Body: { channel: 'whatsapp' | 'email', message?: string }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const sendSchema = z.object({
  channel: z.enum(['whatsapp', 'email']),
  message: z.string().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = sendSchema.parse(await req.json())

    // Fetch suggestion + contact
    const { data: suggestion, error: fetchError } = await supabase
      .from('nurturing_suggestions')
      .select(`*, contacts!inner(name, phone, email)`)
      .eq('id', id)
      .single()

    if (fetchError || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    const message = body.message ?? suggestion.suggested_message
    const contact = suggestion.contacts as { name: string; phone: string; email: string }

    if (body.channel === 'whatsapp' && contact.phone) {
      const evolutionUrl = process.env.EVOLUTION_API_URL
      const evolutionKey = process.env.EVOLUTION_API_KEY
      const instanceName = process.env.EVOLUTION_INSTANCE_NAME

      if (evolutionUrl && evolutionKey && instanceName) {
        const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
          body: JSON.stringify({ number: contact.phone, text: message }),
        })
        if (!res.ok) {
          const errText = await res.text()
          console.error('[nurturing/send] Evolution API error:', errText)
          return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 502 })
        }
      }
    }

    // Mark as sent
    const { error: updateError } = await supabase
      .from('nurturing_suggestions')
      .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('[POST /api/nurturing/[id]/send]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
