import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  sassOptions: { quietDeps: true, silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'] },
  poweredByHeader: false,
  output: 'standalone', // small self-contained server for Docker
  outputFileTracingRoot: path.join(here, '../../'), // monorepo: trace dependencies from the repo root
};
