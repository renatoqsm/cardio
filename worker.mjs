// Keep OpenNext's request handling and durable-object exports intact.
import worker from './.open-next/worker.js';
export * from './.open-next/worker.js';
export default {
  ...worker,
  async scheduled(_controller, env, ctx) {
    if (!env.PUSH_JOB_SECRET) return;
    const request = new Request(`${env.BETTER_AUTH_URL}/api/internal/push`, {
      method: 'POST', headers: { 'x-pulso-job-key': env.PUSH_JOB_SECRET },
    });
    ctx.waitUntil(worker.fetch(request, env, ctx).then(response => {
      if (!response.ok) throw new Error(`Push job failed: ${response.status}`);
    }));
  },
};
