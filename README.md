# hoikubag — 保育園準備アプリ

保育園に通う子どもの翌日の持ち物を素早く準備するためのモバイルファースト Web アプリ。

- 各品目を大きな +/− ボタンで素早く加減
- 複数の子どもに対応(タブ切り替え)
- 明日の気温を手動入力 → しきい値(既定 23°C)で長袖/半袖を警告
- データは端末内(localStorage)に保存

> 天気の自動取得と家族間のクラウド同期は v2 で対応予定(下記参照)。

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
src/
  App.tsx                 # ルート。状態を束ねて各コンポーネントを配置
  main.tsx
  types.ts                # Child / Location / Weather / AppState
  constants.ts            # ITEMS / ACCENT / STORAGE_KEY など
  lib/
    storage.ts            # 永続化の抽象レイヤ(StorageProvider)
    icons.ts              # 天気テキスト → アイコン
    date.ts               # uid / tomorrowLabel
    weather.ts            # 天気自動取得スタブ(v2)
  hooks/
    useAppState.ts        # state + 全アクション + 画面復帰時の再読込
  components/
    BagSummary.tsx        # 明日のかばん(全員分)
    WeatherCard.tsx       # 天気カード(手動入力/表示/袖警告)
    InlineTempInput.tsx   # 気温クイック入力
    ChildTabs.tsx         # 子どもタブ
    ItemList.tsx          # 持ち物リスト
    SettingsModal.tsx     # 設定モーダル
```

## Vercel へのデプロイ

1. このリポジトリを GitHub に push する。
2. [vercel.com](https://vercel.com) で GitHub アカウントを連携し、`hoikubag`
   リポジトリを **Import** する。
3. Framework Preset は **Vite** が自動検出される。
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - 環境変数は不要。
4. **Deploy** を押すと公開 URL が発行される。以後、main への push ごとに自動デプロイ
   され、ブランチへの push にはプレビュー URL が割り当てられる。

無料の Hobby プランで完結する。

## 今後の拡張(v2 メモ)

### 家族間のデータ同期(無料枠)

`src/lib/storage.ts` の `StorageProvider` インターフェースを差し替えるだけで、
コンポーネントを変更せずにクラウド同期を追加できる設計。

1. Vercel Marketplace から **Upstash Redis**(無料枠)を追加。
2. `api/state.ts` を Vercel Serverless Function として作成し、
   `family:<familyId>` キーで状態を読み書き。
3. `KvStorageProvider`(storage.ts のコメント参照)を実装し、`storage` を差し替え。
4. `familyId` を URL クエリ(`?f=xxxx`)で家族に共有。競合は `updatedAt` の
   大きい方を採用(last-write-wins)。

### 天気の自動取得

`src/lib/weather.ts` のスタブを実装。気象庁オープンデータ
(`https://www.jma.go.jp/bosai/forecast/data/forecast/{areaCode}.json`)を優先し、
Open-Meteo をフォールバックに。日付計算は JST、週間予報の気温を優先、
`tempsMax/Min` が空文字のケースに注意。
