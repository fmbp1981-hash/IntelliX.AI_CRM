// OpenAPI 3.1.2 "source of truth" for NossoCRM Public API (Integrations).
//
// NOTE:
// - Keep this file updated together with route implementations.
// - Prefer stable, integration-friendly shapes (simple objects, consistent errors).

export type OpenApiDocument = Record<string, any>;

export function getPublicApiOpenApiDocument(): OpenApiDocument {
  return {
    openapi: '3.1.2',
    info: {
      title: 'NossoCRM Public API',
      version: 'v1',
      description:
        'API pública do NossoCRM para integrações (n8n/Make). Produto em primeiro lugar: copiar → colar → testar.',
    },
    servers: [{ url: '/api/public/v1' }],
    tags: [
      { name: 'Meta', description: 'Sobre a API e autenticação' },
      { name: 'Boards', description: 'Pipelines/boards e etapas' },
      { name: 'Companies', description: 'Empresas (clientes do CRM)' },
      { name: 'Contacts', description: 'Contatos (leads/pessoas)' },
      { name: 'Deals', description: 'Negócios (cards)' },
      { name: 'Activities', description: 'Atividades (nota/tarefa/reunião/ligação)' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Api-Key',
          description: 'Chave gerada na interface (Settings → Integrações).',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          additionalProperties: false,
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
          },
          required: ['error'],
        },
        PaginatedResponse: {
          type: 'object',
          additionalProperties: false,
          properties: {
            data: { type: 'array', items: {} },
            nextCursor: { type: 'string', nullable: true },
          },
          required: ['data'],
        },
      },
      responses: {
        Unauthorized: {
          description: 'API key ausente ou inválida',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                missing: { value: { error: 'Missing X-Api-Key', code: 'AUTH_MISSING' } },
                invalid: { value: { error: 'Invalid API key', code: 'AUTH_INVALID' } },
              },
            },
          },
        },
      },
    },
    paths: {
      '/openapi.json': {
        get: {
          tags: ['Meta'],
          summary: 'OpenAPI document (JSON)',
          description: 'Documento OpenAPI 3.1.2 desta API.',
          responses: {
            200: {
              description: 'OpenAPI document',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      // Endpoints below will be implemented next and MUST be kept in sync:
      '/me': {
        get: {
          tags: ['Meta'],
          summary: 'Identidade da API key',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          organization_id: { type: 'string' },
                          organization_name: { type: 'string' },
                          api_key_prefix: { type: 'string' },
                        },
                        required: ['organization_id', 'organization_name', 'api_key_prefix'],
                      },
                    },
                    required: ['data'],
                    additionalProperties: false,
                  },
                  examples: {
                    ok: {
                      value: {
                        data: {
                          organization_id: '00000000-0000-0000-0000-000000000000',
                          organization_name: 'Minha Empresa',
                          api_key_prefix: 'ncrm_abc123',
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
    },
  };
}

