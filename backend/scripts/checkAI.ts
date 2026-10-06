import { config } from 'dotenv';
config({ path: '.env.local' });
const key = process.env.APINEX_API_KEY;
if (!key) throw new Error('Configure APINEX_API_KEY in ignored backend/.env.local first.');
const models = [process.env.APINEX_PRIMARY_MODEL || 'free/deepseek-v4.1-flash', process.env.APINEX_FALLBACK_MODEL || 'free/mimo-v2.6-pro'];
const response = await fetch('https://api.apinex.bond/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Provider catalog unavailable (HTTP ${response.status}); no key or provider body logged.`);
const result = await response.json() as { data?: Array<{ id: string }> };
const available = new Set(result.data?.map(model => model.id));
for (const model of models) {
  console.log(`${model}: ${available.has(model) ? 'listed' : 'NOT LISTED — update model env before testing'}`);
  if (!available.has(model)) process.exitCode = 1;
}
if (process.argv.includes('--smoke') && !process.exitCode) {
  const { requestLearningAnswer } = await import('../src/utils/learningAI.ts');
  const answer = await requestLearningAnswer('Explain what a function returns in one sentence.', [{ id: 'sample:1', text: 'A function uses return to give a computed value back to its caller.' }]);
  console.log(`Text-only smoke response received from ${answer.model}; fallback=${answer.fallback}; output length=${answer.answer.length}. No prompt or answer logged.`);
}
