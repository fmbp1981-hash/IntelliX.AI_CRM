/**
 * POST /api/pipeline-triggers/execute
 *
 * Executes pipeline trigger actions for a deal stage change.
 * Called fire-and-forget by useMoveDeal after a deal is moved to a new stage.
 *
 * Actions supported:
 *   notify_team    → insert into system_notifications
 *   create_activity → insert into activities
 *   add_tag        → append tag to deal.tags
 *   send_email     → (future) Resend integration
 *   send_whatsapp  → (future) Evolution API integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const executeSchema = z.object({
  deal_id: z.string().uuid(),
  board_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  event: z.enum(['on_enter', 'on_exit']),
  // Denormalized deal fields needed for action payloads
  deal_title: z.string(),
  contact_id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = executeSchema.parse(await req.json())

    // Fetch active triggers for this board+stage+event
    const { data: triggers, error: triggerError } = await supabase
      .from('pipeline_triggers')
      .select('*')
      .eq('organization_id', body.organization_id)
      .eq('board_id', body.board_id)
      .eq('stage_id', body.stage_id)
      .eq('trigger_event', body.event)
      .eq('active', true)

    if (triggerError) throw triggerError
    if (!triggers?.length) return NextResponse.json({ executed: 0 })

    let executed = 0

    for (const trigger of triggers) {
      const actions = (trigger.actions ?? []) as Array<{ type: string; config: Record<string, unknown> }>

      for (const action of actions) {
        try {
          switch (action.type) {
            case 'notify_team': {
              const message = (action.config?.message as string | undefined)
                || `Deal "${body.deal_title}" movido para nova etapa`
              await supabase.from('system_notifications').insert({
                organization_id: body.organization_id,
                type: 'PIPELINE_TRIGGER',
                title: message,
                metadata: {
                  deal_id: body.deal_id,
                  stage_id: body.stage_id,
                  trigger_id: trigger.id,
                },
              })
              executed++
              break
            }

            case 'create_activity': {
              const dueDate = new Date()
              dueDate.setDate(dueDate.getDate() + ((action.config?.due_days as number | undefined) ?? 1))
              await supabase.from('activities').insert({
                organization_id: body.organization_id,
                deal_id: body.deal_id,
                contact_id: body.contact_id ?? null,
                type: (action.config?.activity_type as string | undefined) ?? 'TASK',
                title: (action.config?.title as string | undefined) ?? 'Tarefa automática',
                due_date: dueDate.toISOString(),
                status: 'PENDING',
                created_by: user.id,
              })
              executed++
              break
            }

            case 'add_tag': {
              const tag = action.config?.tag as string | undefined
              if (tag) {
                const { data: deal } = await supabase
                  .from('deals')
                  .select('tags')
                  .eq('id', body.deal_id)
                  .single()
                const currentTags: string[] = deal?.tags ?? []
                if (!currentTags.includes(tag)) {
                  await supabase
                    .from('deals')
                    .update({ tags: [...currentTags, tag], updated_at: new Date().toISOString() })
                    .eq('id', body.deal_id)
                  executed++
                }
              }
              break
            }

            // send_email and send_whatsapp: future implementation
            case 'send_email':
            case 'send_whatsapp':
              console.log(`[pipeline-triggers/execute] Action ${action.type} not yet implemented, skipping`)
              break

            default:
              console.warn(`[pipeline-triggers/execute] Unknown action type: ${action.type}`)
          }
        } catch (actionErr) {
          // Non-critical: log and continue with other actions
          console.error(`[pipeline-triggers/execute] Action ${action.type} failed for trigger ${trigger.id}:`, actionErr)
        }
      }
    }

    return NextResponse.json({ executed })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 })
    }
    console.error('[POST /api/pipeline-triggers/execute]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
