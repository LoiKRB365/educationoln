import { submissionsHandler } from './auth.js';

export default async function handler(req, res) {
  return submissionsHandler(req, res);
}
