import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },
  transpilePackages: [
    '@opentelemetry/api',
    '@opentelemetry/sdk-trace-web',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/instrumentation',
    '@opentelemetry/instrumentation-document-load',
    '@opentelemetry/instrumentation-fetch',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/core',
  ],
}

export default nextConfig
