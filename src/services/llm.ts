import * as dotenv from 'dotenv';

dotenv.config();

// MiniMax Token Plan configuration
// Token Plan uses Anthropic-compatible API
export const llmConfig = {
  // Token Plan API key from .env
  apiKey: process.env.TOKEN_PLAN_KEY || process.env.MINIMAX_API_KEY || '',

  // MiniMax Token Plan base URL (Anthropic-compatible)
  baseURL: 'https://api.minimax.io/anthropic/v1',

  // Model for Token Plan - MiniMax-M2.7 via Anthropic compatibility
  model: 'MiniMax-M2.7',

  // Model settings
  temperature: 0.7,
  maxTokens: 1024,
};

// Validate config
export function validateLlmConfig(): boolean {
  if (!llmConfig.apiKey) {
    console.error('❌ MINIMAX_API_KEY is not set in .env');
    return false;
  }
  console.log('✓ MiniMax API key configured');
  return true;
}
