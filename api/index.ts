// Vercel Function: every /api/* request is rewritten here (see vercel.json) and handled by the
// same Express app that server.ts runs locally and on Cloud Run.
import app from '../server.ts';

export default app;
