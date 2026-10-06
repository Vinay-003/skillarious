import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { isResendConfigured, isVercelRelayConfigured } from '../src/utils/sendEmail.ts';

type Environment = Record<string, string | undefined>;
type Dependencies = {
  env: Environment;
  send: (email: string, subject: string, message: string) => Promise<unknown>;
  log: (message: string) => void;
};

export function parseArgs(args: string[]): { smoke: boolean } {
  if (args.length === 0) return { smoke: false };
  if (args.length === 1 && args[0] === '--smoke') return { smoke: true };
  throw new Error('Unsupported email check arguments');
}

export async function main(args: string[], dependencies: Dependencies): Promise<number> {
  let smoke: boolean;
  try {
    smoke = parseArgs(args).smoke;
  } catch {
    dependencies.log('Unsupported arguments. Use no arguments or --smoke only.');
    return 1;
  }
  const provider = dependencies.env.EMAIL_PROVIDER || 'resend';
  const configured = provider === 'resend'
    ? isResendConfigured(dependencies.env)
    : provider === 'vercel_smtp'
      ? isVercelRelayConfigured(dependencies.env)
      : false;
  if (!configured) {
    dependencies.log(provider === 'vercel_smtp'
      ? 'Email relay configuration is missing or invalid. Check EMAIL_RELAY_URL and EMAIL_RELAY_TOKEN locally.'
      : 'Email configuration is missing or invalid. Check EMAIL_PROVIDER, RESEND_API_KEY and RESEND_FROM locally.');
    return 1;
  }
  if (!smoke) {
    dependencies.log(provider === 'vercel_smtp' ? 'Email relay configuration is valid locally; no message sent.' : 'Email configuration is valid locally; no message sent.');
    return 0;
  }
  if (provider === 'vercel_smtp') {
    dependencies.log('Relay smoke is disabled by default because it would send a real email. Use a controlled recipient through the deployed flow.');
    return 1;
  }
  try {
    await dependencies.send('delivered@resend.dev', 'Synthetic email smoke test', 'This is a synthetic plain-text email provider smoke test.');
    dependencies.log('Email provider accepted the synthetic smoke request; inbox delivery is not verified.');
    return 0;
  } catch {
    dependencies.log('Email smoke request failed; check provider configuration and status locally.');
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), override: false });
  const result = await main(process.argv.slice(2), {
    env: process.env,
    send: async (email, subject, message) => {
      const { sendEmail } = await import('../src/utils/sendEmail.ts');
      return sendEmail(email, subject, message);
    },
    log: message => console.log(message),
  });
  process.exitCode = result;
}
