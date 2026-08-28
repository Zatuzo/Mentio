#!/usr/bin/env node
// One-time script to configure CORS on the R2 bucket.
// Run: node scripts/setup-r2-cors.mjs
import 'dotenv/config';
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Missing R2_* env vars. Copy from .env or set them.');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: ['https://mentio.space', 'http://localhost:3000', 'http://localhost:9000'],
      AllowedMethods: ['PUT', 'GET', 'HEAD'],
      AllowedHeaders: ['content-type', 'content-length', 'x-amz-*', 'cache-control'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    },
  ],
};

console.log(`Setting CORS on bucket: ${R2_BUCKET_NAME}`);
await client.send(new PutBucketCorsCommand({
  Bucket: R2_BUCKET_NAME,
  CORSConfiguration: corsConfig,
}));

const { CORSRules } = await client.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
console.log('✓ CORS configured:');
console.log(JSON.stringify(CORSRules, null, 2));
