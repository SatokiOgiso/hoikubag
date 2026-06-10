# hoikubag — 保育園準備アプリ

保育園に通う子どもの持ち物を日付ごとに素早く準備するためのモバイルファースト Web アプリ。

- **最上部の日付ストリップ**(横スクロール)で日付を選び、日付ごとにかばんの中身を設定・確認
  - 各日付セルに天気アイコンと最低/最高気温を簡潔表示(気温は色分け)
- 各品目を大きな +/− ボタンで素早く加減
- リストにない持ち物(バスタオルなど)を設定から追加・削除できる
- 複数の子どもに対応(タブ切り替え)
- 昨日・今日・明日の天気をアクセスのたび自動取得(今日・明日は気象庁、昨日は Open-Meteo)→ 選択日の最高気温がしきい値(既定 23°C)超で半袖/以下で長袖を警告
- データは端末内(localStorage)に保存。**家族共有を有効にするとクラウド同期**
- 共有リンク(`?f=<familyId>`)を家族に送るだけで同じデータを表示・編集できる


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

> **重要:** この環境変数が未設定のまま「共有を開始」しても、`/api/state` が
> エラーを返し、データは端末内に留まる(家族間で同期されない)。その場合、設定の
> 「家族とのデータ同期」に **⚠️ クラウドに接続できていません** と表示される。
> Upstash を連携し、変数設定後に **再デプロイ**すると解消する。

### 通知(リマインド)を使う場合の環境変数

毎晩の準備リマインドと「確定のお願い」通知(Web Push)を使う場合は、以下も設定する。

| 変数 | 説明 |
|------|------|
| `VAPID_PUBLIC_KEY` / `VITE_VAPID_PUBLIC_KEY` | VAPID 公開鍵(サーバー用 / クライアント用。同じ値) |
| `VAPID_PRIVATE_KEY` | VAPID 秘密鍵 |
| `VAPID_SUBJECT` | `mailto:` から始まる連絡先(任意) |
| `CRON_SECRET` | **必須**。Cron(`/api/cron`)の認証に使う任意の長い文字列 |

> **重要:** `CRON_SECRET` を設定しないと `/api/cron` は実行を拒否する(誰でも叩ける
> 状態を防ぐため)。リマインド通知を有効にするには、Vercel の環境変数に
> `CRON_SECRET` を設定して再デプロイすること。Vercel Cron は自動でこの値を
> `Authorization: Bearer <CRON_SECRET>` として付与する。

### Upstash セットアップ手順(無料)

1. Vercel のプロジェクト → **Storage**(または Integrations / Marketplace)→ **Upstash for Redis** を追加。
2. データベースをこのプロジェクトに **Connect** する。`KV_REST_API_URL` /
   `KV_REST_API_TOKEN` が自動で環境変数に追加される。
3. **Deployments → 最新を Redeploy**(環境変数は再デプロイで反映される)。
4. アプリの設定で「家族と共有を開始」→ **クラウドと同期できています** と表示されれば成功。
   共有リンクを家族に送る。

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

## 天気の自動取得(ハイブリッド)

`src/lib/weather.ts` で 2 ソースを併用する(いずれも無料・APIキー不要・CORS 許可済み・
サーバー関数不要)。精度を優先し、予報は気象庁を使う。

| 日 | ソース | 理由 |
|----|--------|------|
| 今日・明日 | **気象庁** `forecast/data/forecast/{officeCode}.json` | 国内の予報精度が高い |
| 昨日 | **Open-Meteo** (`past_days=1`) | 気象庁の予報APIは過去日を返さないため |

- 地域名(都道府県)→ 気象庁 office コード / 県庁所在地の緯度経度(各全47)を解決。
  「東京都新宿区」のように都道府県名を含む文字列にも対応(完全名照合で 京都/東京 の誤マッチを回避)。
- 気象庁: 気温は**週間予報**(`tempsMax/Min`)を優先し、空文字 `""` を `0` と誤認しないようガード。
  取れなければ短期予報の気温へフォールバック。天気は日本語テキストをそのままアイコン判定に利用。
- Open-Meteo: WMO weather code を日本語ラベル(`wmoToLabel`)へ変換。
- **気象庁が取得できなかった日は Open-Meteo で補完**(`Promise.allSettled` で両取得、`hasData` で判定)。
- 日付はすべて **JST** で計算(`jstDateOffset` / `jstWeekday`)。明日の最高気温で袖を警告。
- 気温は「最低 / 最高」を大きく表示し、値に応じて色分け(15°緑 → 25°赤オレンジ → 30°赤 → 35°紫、
  アンカー間は線形補間)。`tempColor` 参照。
- **手動入力は廃止**。アプリ起動(マウント)時と地域変更時に自動取得し、再取得ボタンも用意。
- 天気はクラウド同期せず**デバイスごとに毎回取得**(揮発)。家族同期の対象は地域・しきい値など。

### 今後の拡張(v2 メモ)

- 都道府県内の複数地点(市区町村)の細かい選択。
- 取得失敗時のリトライ/キャッシュ表示。
