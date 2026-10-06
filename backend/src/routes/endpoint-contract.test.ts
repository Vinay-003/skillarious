import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../app.ts';
import auth from './auth.ts'; import otp from './otp.ts'; import courses from './course.ts'; import payments from './payment.ts'; import reviews from './review.ts'; import educators from './educator.ts'; import content from './content.ts'; import users from './user.ts'; import student from './student.ts'; import admin from './admin.ts'; import ai from './ai.ts';

const routers: Array<[string, any]> = [['auth', auth], ['otp', otp], ['courses', courses], ['payments', payments], ['reviews', reviews], ['educators', educators], ['content', content], ['users', users], ['student', student], ['admin', admin], ['ai', ai]];
const app = createApp();
for (const [prefix, router] of routers) {
  let guarded = false;
  for (const layer of router.stack) {
    if (!layer.route) { if (layer.handle.name === 'authenticateUser') guarded = true; continue; }
    const route = layer.route;
    if (!guarded && !route.stack.some((handler: any) => handler.handle.name === 'authenticateUser')) continue;
    const path = `/api/v1/${prefix}${route.path.replace(/:[A-Za-z]+/g, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')}`;
    for (const method of Object.keys(route.methods)) {
      it(`${method.toUpperCase()} ${prefix}${route.path} rejects missing authentication`, async () => {
        const result = await (request(app) as any)[method](path).send({});
        expect(result.status).toBe(401); expect(result.body.success).toBe(false);
      });
    }
  }
}
it('health is liveness only and unknown endpoints are JSON 404', async () => {
  expect((await request(app).get('/health')).status).toBe(200);
  expect((await request(app).get('/api/v1/unknown')).status).toBe(404);
});
it('rejects malformed JSON without exposing internals', async () => {
  const result = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{');
  expect(result.status).toBe(400); expect(result.body.message).toBe('Invalid request');
});
