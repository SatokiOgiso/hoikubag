import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { del } from '@vercel/blob';

/**
 * 書類写真の保存用エンドポイント(Vercel Blob)。
 *
 * - POST /api/blob              … クライアントアップロードのトークン発行(@vercel/blob/client の upload() が使用)
 * - POST /api/blob?action=delete … { url } の Blob を削除
 *
 * 必要な環境変数: BLOB_READ_WRITE_TOKEN(Vercel で Blob ストアを接続すると自動設定)。
 * 未設定の場合は 503 を返し、クライアント側で「セットアップが必要」と案内する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'blob_not_configured' });
  }

  // 削除
  if (req.query.action === 'delete') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const url = body?.url;
      if (typeof url !== 'string' || !url) {
        return res.status(400).json({ error: 'invalid url' });
      }
      await del(url);
      return res.status(200).json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'server error';
      return res.status(500).json({ error: message });
    }
  }

  // アップロード(クライアントアップロードのハンドシェイク)
  try {
    const jsonResponse = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
        addRandomSuffix: true,
        maximumSizeInBytes: 15 * 1024 * 1024,
      }),
      // 公開URLが必要なため localhost では発火しない。本番では何もしないでよい。
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'server error';
    return res.status(400).json({ error: message });
  }
}
