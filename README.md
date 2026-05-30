# hoikubag — 保育園準備アプリ

保育園に通う子どもの翌日の持ち物を素早く準備するためのモバイルファースト Web アプリ。

- 各品目を大きな +/− ボタンで素早く加減
- 複数の子どもに対応(タブ切り替え)
- 明日の気温を手動入力 → しきい値(既定 23°C)で長袖/半袖を警告
- データは端末内(localStorage)に保存。**家族共有を有効にするとクラウド同期**
- 共有リンク(`?f=<familyId>`)を家族に送るだけで同じデータを表示・編集できる

> 天気の自動取得は v2 で対応予定(下記参照)。

## 技術スタック

- Vite + React 18 + TypeScript
- Tailwind CSS
- lucide-react(アイコン)

## ローカル開発

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 型チェック + 本番ビルド(dist/)
npm run preview  # 本番ビルドのプレビュー
```

## ディレクトリ構成

```
api/
  state.ts                # 家族共有用 Serverless Function(Upstash Redis)
src/
  App.tsx                 # ルート。状態を束ねて各コンポーネントを配置
  main.tsx
  types.ts                # Child / Location / Weather / AppState
  constants.ts            # ITEMS / ACCENT / STORAGE_KEY など
  lib/
    storage.ts            # 永続化の抽象レイヤ(Local / Kv Provider, familyId 管理)
    icons.ts              # 天気テキスト → アイコン
    date.ts               # uid / tomorrowLabel
    weather.ts            # 天気自動取得スタブ(v2)
  hooks/
    useAppState.ts        # state + 全アクション + 共有 + 画面復帰時の再読込
  components/
    BagSummary.tsx        # 明日のかばん(全員分)
    WeatherCard.tsx       # 天気カード(手動入力/表示/袖警告)
    InlineTempInput.tsx   # 気温クイック入力
    ChildTabs.tsx         # 子どもタブ
    ItemList.tsx          # 持ち物リスト
    SettingsModal.tsx     # 設定モーダル(共有リンクの発行・コピー含む)
```

## 家族間のデータ同期(共有)

仕組み:

- 「設定 → 家族とのデータ同期 → 家族と共有を開始」で **familyId** を発行し、
  以降は `/api/state` 経由で **Upstash Redis** に状態を保存(クラウド同期)。
- 発行された共有リンク(`?f=<familyId>`)を家族に送る。受け取った人が開くと
  自動で同じ familyId を使い、同じデータを表示・編集できる。
- 競合は `updatedAt` の新しい方を採用(last-write-wins)。タブ復帰・フォーカス時に
  クラウドの最新を取り込む。オフライン時は localStorage キャッシュで動作し、
  オンライン復帰後に再同期される。
- 共有を使わない場合は localStorage のみ(従来どおり端末内保存)。

### 必要な環境変数(共有を使う場合)

Vercel の **Marketplace → Upstash** 連携を追加すると、以下が自動で設定される:

| 変数 | 説明 |
|------|------|
| `KV_REST_API_URL` | Upstash Redis REST エンドポイント |
| `KV_REST_API_TOKEN` | Upstash Redis REST トークン |

(Upstash 既定の `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` も可。)
未設定でもアプリは起動し、共有を有効にしない限り localStorage のみで動作する。

ローカルで `/api` を含めて動かすには `vercel dev`(環境変数を読み込む)を使う。
通常の `npm run dev` では `/api` は配信されず、共有有効時もローカルキャッシュで動作する。

## Vercel へのデプロイ

1. このリポジトリを GitHub に push する。
2. [vercel.com](https://vercel.com) で GitHub アカウントを連携し、`hoikubag`
   リポジトリを **Import** する。
3. Framework Preset は **Vite** が自動検出される。
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - `api/state.ts` は Serverless Function として自動的にビルドされる。
4. **Deploy** を押すと公開 URL が発行される。以後、main への push ごとに自動デプロイ
   され、ブランチへの push にはプレビュー URL が割り当てられる。
5. (家族共有を使う場合)プロジェクトの **Storage / Marketplace → Upstash** を追加すると
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` が自動で設定される。設定後に再デプロイすると
   `/api/state` が有効になる(詳細は「家族間のデータ同期」参照)。

無料の Hobby プラン + Upstash 無料枠で完結する。

## 今後の拡張(v2 メモ)

### 天気の自動取得

`src/lib/weather.ts` のスタブを実装。気象庁オープンデータ
(`https://www.jma.go.jp/bosai/forecast/data/forecast/{areaCode}.json`)を優先し、
Open-Meteo をフォールバックに。日付計算は JST、週間予報の気温を優先、
`tempsMax/Min` が空文字のケースに注意。
