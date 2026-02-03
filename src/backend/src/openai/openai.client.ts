import OpenAI from 'openai';

export class OpenAIClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async createJsonCompletion(params: {
    system: string;
    developer: string;
    user: string;
  }): Promise<{ content: string; model: string }> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: 'system', content: params.system },
        { role: 'developer', content: params.developer },
        { role: 'user', content: params.user },
      ],
      text: { format: { type: 'json_object' } },
      temperature: 0.2,
    });

    const content = extractOutputText(response);
    if (!content) {
      throw new Error('Empty response from model');
    }

    return { content, model: response.model ?? this.model };
  }
}

function extractOutputText(response: unknown): string | null {
  const asAny = response as {
    output_text?: string | null;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };

  if (asAny.output_text) {
    return asAny.output_text;
  }

  const output = asAny.output;
  if (!output) return null;
  for (const item of output) {
    if (item.type !== 'message' || !item.content) continue;
    for (const content of item.content) {
      if (content.type === 'output_text' && content.text) {
        return content.text;
      }
      if (content.text) {
        return content.text;
      }
    }
  }

  return null;
}
