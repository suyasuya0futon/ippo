# IPPO

AI サポート付きのタスク管理アプリです。

## 開発

```bash
npm install
npm run dev
```

本番ビルド確認:

```bash
npm run build
```

lint:

```bash
npm run lint
```

## 環境変数

`.env.example` をコピーして `.env.local` を作成します。

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`VITE_SUPABASE_ANON_KEY` は Supabase の anon public key です。service role key はクライアントに置かないでください。

## Supabase セットアップ

IPPO のテーブルは `ippo` スキーマに作ります。

新規 Supabase プロジェクトで初めて作る場合:

1. Supabase SQL Editor で `supabase/schema.sql` を実行する
2. Supabase Dashboard の Settings -> API -> Exposed schemas に `ippo` を追加する
3. アプリを起動して GitHub ログインを確認する

## 既存DBの migration

`schema.sql` は `create table if not exists` を使っているため、既存テーブルへ後から列を追加する用途には使えません。
既存DBを更新するときは、必要な migration SQL を Supabase SQL Editor で実行してください。

現在の migration:

- `supabase/migrate_tag.sql`
  - 旧 `items.tags text[]` を `items.tag text` に移行します。
- `supabase/migrate_tag_and_notes.sql`
  - `done_logs.tag` を追加します。
  - 旧 `done_logs.memo` を廃止します。
  - `day_notes` テーブルを作成します。

migration を実行した後、必要に応じてアプリを再読み込みしてください。

## 初期データ

新規ログインユーザーのデータが空の場合、`src/seed.ts` のダミー初期データが投入されます。
既存ユーザーに対して再投入はされません。
