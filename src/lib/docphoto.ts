import { upload } from '@vercel/blob/client';
import type { DocImage } from '../types';
import { uid } from './date';

/** 書類写真の長辺の最大px(これより大きい写真は縮小してから保存) */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;

export class BlobNotConfiguredError extends Error {
  constructor() {
    super('blob_not_configured');
    this.name = 'BlobNotConfiguredError';
  }
}

interface Resized {
  blob: Blob;
  width: number;
  height: number;
}

/** 画像ファイルを縮小して JPEG Blob にする。縮小不要でも JPEG に正規化する */
async function resizeImage(file: File): Promise<Resized> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('画像を表示できませんでした'));
    i.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画像の変換に失敗しました');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) throw new Error('画像の変換に失敗しました');
  return { blob, width, height };
}

/** 画像ファイルを縮小し Vercel Blob にアップロードして DocImage を返す */
export async function uploadDocImage(file: File): Promise<DocImage> {
  const { blob, width, height } = await resizeImage(file);
  const pathname = `docs/${uid()}.jpg`;
  try {
    const result = await upload(pathname, blob, {
      access: 'public',
      handleUploadUrl: '/api/blob',
      contentType: 'image/jpeg',
    });
    return { url: result.url, pathname: result.pathname, width, height };
  } catch (e) {
    // サーバーが Blob 未設定(503)の場合は専用エラーにする
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('blob_not_configured') || msg.includes('503')) {
      throw new BlobNotConfiguredError();
    }
    throw e;
  }
}

/** Blob から書類写真を削除(失敗しても致命的でないので呼び出し側で握りつぶし可) */
export async function deleteDocImage(url: string): Promise<void> {
  await fetch('/api/blob?action=delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}
