import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const StageSchema = z.object({
    id: z.string(),
    name: z.string(),
});

export const AgentOptionsSchema = z.object({
    view: z.object({
        type: z.enum(['kanban', 'list', 'details', 'cockpit', 'global']),
        name: z.string().optional(),
        url: z.string().optional(),
    }).optional(),

    activeObject: z.object({
        type: z.enum(['deal', 'contact', 'board']),
        id: z.string(),
        name: z.string().optional(),
        status: z.string().optional(),
        value: z.number().optional(),
        metadata: z.object({
            boardId: z.string().optional(),
            stages: z.array(StageSchema).optional(),
            columns: z.string().optional(),
        }).catchall(z.any()).optional(),
    }).optional(),

    filters: z.record(z.any()).optional(),
});

export type AgentOptions = z.infer<typeof AgentOptionsSchema>;
