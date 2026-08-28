import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';

const accountId = process.env.R2_ACCOUNT_ID!;
const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
const bucket = process.env.R2_BUCKET_NAME!;
const publicUrl = process.env.R2_PUBLIC_URL!; // e.g. https://pub-xxx.r2.dev or custom domain

let _client: S3Client | null = null;

function getClient() {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _client;
}

export function isR2Configured() {
  return !!(accountId && accessKeyId && secretAccessKey && bucket && publicUrl);
}

export async function uploadToR2(
  buffer: Buffer,
  mimeType: string,
  folder = 'uploads'
): Promise<string> {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const key = `${folder}/${randomUUID()}.${ext}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return `${publicUrl.replace(/\/$/, '')}/${key}`;
}

export async function deleteFromR2(url: string) {
  try {
    const base = publicUrl.replace(/\/$/, '');
    if (!url.startsWith(base)) return;
    const key = url.slice(base.length + 1);
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch {
    // best-effort
  }
}

// Derive folder from userId for user uploads
export function userFolder(userId: string) {
  return `uploads/${userId}`;
}

// Generate a presigned PUT URL so the browser can upload directly to R2,
// bypassing the Next.js server (and Nginx) entirely.
export async function presignUpload(
  mimeType: string,
  folder: string,
  expiresIn = 300 // 5 minutes
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const key = `${folder}/${randomUUID()}.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  const uploadUrl = await getSignedUrl(getClient(), cmd, { expiresIn });
  return {
    uploadUrl,
    publicUrl: `${publicUrl.replace(/\/$/, '')}/${key}`,
  };
}
