import type { NextConfig } from 'next';
const config: NextConfig = { output: 'standalone', transpilePackages: ['@intellideploy/api-client'] };
export default config;
