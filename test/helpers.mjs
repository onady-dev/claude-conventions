import { fileURLToPath } from 'node:url';
import { loadProject } from '../lib/project.mjs';

export const REPO = fileURLToPath(new URL('..', import.meta.url));
export const FIXTURE = fileURLToPath(new URL('./fixtures/mini-nest', import.meta.url));
export const loadFixture = () => loadProject({ projectRoot: FIXTURE });
