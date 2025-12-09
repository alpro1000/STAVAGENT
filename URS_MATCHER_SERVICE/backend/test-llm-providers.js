/**
 * Test LLM Providers Configuration
 * Check which providers are available and in what order
 */

import dotenv from 'dotenv';
import { getLLMConfig, getAvailableProviders, getFallbackChain } from './src/config/llmConfig.js';
import { logger } from './src/utils/logger.js';

dotenv.config();

console.log('\n========================================');
console.log('🔍 LLM PROVIDERS CONFIGURATION TEST');
console.log('========================================\n');

// Get primary configuration
const config = getLLMConfig();

console.log('📌 PRIMARY CONFIGURATION:');
console.log(`   Provider: ${config.provider}`);
console.log(`   Model: ${config.model}`);
console.log(`   Enabled: ${config.enabled}`);
console.log(`   API Key: ${config.apiKey ? '✅ SET (***' + config.apiKey.slice(-4) + ')' : '❌ NOT SET'}`);
console.log(`   Timeout: ${config.timeoutMs}ms\n`);

// Get available providers
const providers = getAvailableProviders();

console.log('📋 AVAILABLE PROVIDERS:');
Object.entries(providers).forEach(([name, prov]) => {
  const keyPreview = prov.apiKey ? '***' + prov.apiKey.slice(-4) : 'NOT SET';
  console.log(`   ✅ ${name.toUpperCase()}`);
  console.log(`      Model: ${prov.model}`);
  console.log(`      API Key: ${keyPreview}`);
  console.log(`      Timeout: ${prov.timeoutMs}ms`);
});

if (Object.keys(providers).length === 0) {
  console.log('   ❌ NO PROVIDERS AVAILABLE - Check your API keys!\n');
} else {
  console.log('');
}

// Get fallback chain
const chain = getFallbackChain(config.provider);

console.log('🔄 FALLBACK CHAIN:');
console.log(`   ${chain.map((p, idx) => {
  const available = providers[p] ? '✅' : '❌';
  return `${idx + 1}. ${p.toUpperCase()} ${available}`;
}).join('\n   ')}\n`);

// Check environment variables
console.log('🔑 ENVIRONMENT VARIABLES:');
console.log(`   LLM_PROVIDER: ${process.env.LLM_PROVIDER || '(not set, defaults to gemini)'}`);
console.log(`   LLM_TIMEOUT_MS: ${process.env.LLM_TIMEOUT_MS || '(not set, defaults to 90000)'}`);
console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ SET' : '❌ NOT SET'}`);

console.log('\n========================================');
console.log('📊 SUMMARY:');
console.log('========================================');

if (!config.enabled) {
  console.log('❌ NO PRIMARY PROVIDER AVAILABLE');
  console.log('   → Will use FALLBACK mode (top fuzzy matching candidates)');
} else {
  console.log(`✅ Primary: ${config.provider.toUpperCase()}`);
  const availableFallbacks = chain.slice(1).filter(p => providers[p]);
  if (availableFallbacks.length > 0) {
    console.log(`✅ Fallbacks: ${availableFallbacks.map(p => p.toUpperCase()).join(', ')}`);
  } else {
    console.log('⚠️  No fallback providers available');
  }
}

console.log('========================================\n');
