// All functions in this file use claude-sonnet-4-6
// Report generation for the advisory module will live here

import Anthropic from '@anthropic-ai/sdk';

let anthropic: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}
