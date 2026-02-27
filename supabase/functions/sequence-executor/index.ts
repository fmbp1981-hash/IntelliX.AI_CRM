import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SequenceStep {
  action_type: 'call' | 'email' | 'whatsapp' | 'meeting' | 'task';
  title: string;
  delay_days: number;
  template?: string;
  notes?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("Starting Sequence Executor...")

    const now = new Date().toISOString()

    // 1. Get all due enrollments across ALL organizations
    const { data: dueEnrollments, error: fetchError } = await supabaseAdmin
      .from('deal_sequence_enrollments')
      .select(`
        *,
        deal:deals(id, title, owner_id, organization_id),
        sequence:activity_sequences!inner(id, name, steps)
      `)
      .eq('status', 'active')
      .lte('next_activity_date', now)

    if (fetchError) {
      console.error("Error fetching due enrollments:", fetchError)
      throw fetchError
    }

    if (!dueEnrollments || dueEnrollments.length === 0) {
      console.log("No due enrollments to process.")
      return new Response(JSON.stringify({ processed: 0, message: "No due enrollments" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Found ${dueEnrollments.length} enrollments to process.`)

    let processedCount = 0
    let errorsCount = 0
    const errors: any[] = []

    for (const enrollment of dueEnrollments) {
      try {
        const sequence = enrollment.sequence
        const currentStepIndex = enrollment.current_step
        const step = sequence.steps[currentStepIndex] as SequenceStep

        const organizationId = enrollment.deal?.organization_id

        if (!step) {
          // If no step is found but the enrollment is active, just pause or complete it
          await supabaseAdmin
            .from('deal_sequence_enrollments')
            .update({ status: 'completed', completed_at: new Date().toISOString(), next_activity_date: null })
            .eq('id', enrollment.id)
          continue
        }

        const activityTypeMap: Record<string, string> = {
          call: 'CALL',
          email: 'EMAIL',
          whatsapp: 'WHATSAPP',
          meeting: 'MEETING',
          task: 'TASK',
        }

        // 2. Auto-create the activity
        const { error: createError } = await supabaseAdmin
          .from('activities')
          .insert({
            organization_id: organizationId,
            deal_id: enrollment.deal_id,
            user_id: enrollment.deal?.owner_id,
            type: activityTypeMap[step.action_type] || 'TASK',
            title: `[Sequência] ${step.title}`,
            notes: step.notes || `Gerada via Sequência "${sequence.name}" (Passo ${currentStepIndex + 1}/${sequence.steps.length})`,
            scheduled_date: now,
            status: 'scheduled',
          })

        if (createError) throw createError

        // 3. Advance logic
        const nextStepIndex = currentStepIndex + 1
        let payload: any = { current_step: nextStepIndex }

        if (nextStepIndex >= sequence.steps.length) {
          // Sequence complete
          payload.status = 'completed'
          payload.completed_at = new Date().toISOString()
          payload.next_activity_date = null
        } else {
          // Calculate next date based on the *next* step's delay_days
          const nextStepConfig = sequence.steps[nextStepIndex] as SequenceStep
          const nextDate = new Date()
          nextDate.setDate(nextDate.getDate() + nextStepConfig.delay_days)
          payload.next_activity_date = nextDate.toISOString()
        }

        const { error: advanceError } = await supabaseAdmin
          .from('deal_sequence_enrollments')
          .update(payload)
          .eq('id', enrollment.id)

        if (advanceError) throw advanceError

        processedCount++
      } catch (err: any) {
        console.error(`Error processing enrollment ${enrollment.id}:`, err)
        errorsCount++
        errors.push({ enrollment_id: enrollment.id, error: err.message })
      }
    }

    return new Response(JSON.stringify({
      processed: processedCount,
      errors_count: errorsCount,
      errors: errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
