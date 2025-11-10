# Tier Rank

Tier Rank は、Google アカウントでサインインし、指定したアイテムをエージェントにスコアリングさせる Next.js 製の社内向けツールです。

## 開発

```bash
npm install
npm run dev
```

### 必要な環境変数

`.env.local` に以下を設定してください。

```text
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## OAuth URL マトリクス（Local / Preview / Production）

| 環境 | NEXTAUTH_URL | Google Authorized origins | Google redirect URIs |
| --- | --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:3000` | `http://localhost:3000/api/auth/callback/google` |
| Preview | `https://tier-rank-preview.vercel.app` | `https://tier-rank-preview.vercel.app` | `https://tier-rank-preview.vercel.app/api/auth/callback/google` |
| Production | `https://tier-rank.vercel.app` | `https://tier-rank.vercel.app` | `https://tier-rank.vercel.app/api/auth/callback/google` |

### プレビュー固定ドメインを推奨する理由

- Google OAuth の Authorized origins / redirect URIs は完全一致で登録する必要があります。
- Vercel のブランチプレビュー用ドメインは自動生成されるため、デプロイ毎に URL が変わります。
- 固定の preview ドメイン（例: `tier-rank-preview.vercel.app`）を用意し、`NEXTAUTH_URL` と Google Cloud Console の設定に登録しておくことで、プレビュー環境のたびに OAuth 設定を更新する手間を防げます。
- 本番ドメインを複数運用する場合は、すべてのドメインを Authorized origins / redirect URIs に登録してください。

## Prisma / Database 運用

### スキーマとマイグレーション
- `prisma/schema.prisma` には `User` / `Profile` / `Ranking` を含む全テーブルが定義されています。`Profile` と `Ranking` はそれぞれ `@@map("Profile")` `@@map("Ranking")` でデータベース上のテーブル名と一致させています。
- `prisma/migrations/0001_init/` に初期化マイグレーションがコミット済みで、PostgreSQL に必要なテーブル／インデックス／FK が全て含まれています。
- 追加の変更を入れる際は、必ず `npx prisma migrate dev --name <change>` でマイグレーションファイルを生成し、リポジトリにコミットしてください。

### Vercel 向けビルド・デプロイ設定
- Build Command: `npm run build:vercel`
- 必須環境変数:
  - `DATABASE_URL`: Prisma の接続先。Vercel の Environment Variables に Production / Preview それぞれ登録してください。
  - `DIRECT_URL`: (任意) 接続プールをバイパスする直通接続 URL。`schema.prisma` の `directUrl` 用に登録します。未設定の場合は `DATABASE_URL` と同じ値を入れてください。
- `package.json` のスクリプト構成:
  - `postinstall`: `prisma generate`
  - `build:vercel`: `prisma migrate deploy && prisma generate && next build`
  - 既存の `dev` / `build` / `start` は変更していません。
- Vercel で上記 Build Command を設定すると、ビルド開始時に `prisma migrate deploy` → `prisma generate` → `next build` の順で実行されます。

### Build Logs での確認手順
1. Vercel のデプロイ詳細画面を開き、Logs タブで Build ログを確認します。
2. `prisma migrate deploy` という行が最初期に出力されていることを確認してください。
   - 見つからない場合: Build Command が `npm run build:vercel` 以外になっていないか、`package.json` に最新のスクリプトがコミットされているかを確認します。
   - マイグレーションディレクトリ (`prisma/migrations`) がコミットされていない場合も `migrate deploy` がスキップされるので注意してください。
3. `The following migration(s) have been applied` のような成功ログが続くか、`No pending migrations to apply.` が出力されれば成功です。
4. エラーが表示された場合の代表的な原因と対処:
   - `P1001` / `P1008`: `DATABASE_URL` が誤っている、もしくはホスト・ポートに接続できていません → Vercel の環境変数を再確認し、Neon 側で IP 制限がないか確認する。
   - `P1003`: 権限不足 → DB ユーザーに `CREATE TABLE`, `ALTER TABLE` などの権限が付与されているかを確認する。
   - `P3014`: マイグレーションの依存関係が壊れている → ローカルで `prisma migrate resolve --applied` などを使い整合性を取る。

### 本番 DB に対する手動デプロイ (最終手段)
1. 正しい接続先であることを三重チェックします。
   - `DATABASE_URL` のホスト名・DB 名・ユーザー名が本番環境であるか。
   - `psql` などで `\dt` を実行し、対象 DB に `Profile` `Ranking` テーブルが存在しないことを確認する。
   - `git status` でマイグレーションがすべてコミット済みであることを確認する。
2. 確認後、以下を 1 度だけ実行します。
   ```bash
   DATABASE_URL="<本番のURL>" npx prisma migrate deploy
   ```
3. 実行結果に `No pending migrations to apply.` または `The following migration(s) have been applied:` が表示されれば成功です。
4. 直後に `npx prisma db pull` を実行して diff がないことを確認すると安全です。

### Prisma Client 利用ポリシー
- `lib/prisma.ts` で PrismaClient をグローバルキャッシュし、開発時に複数インスタンスが生成されるのを防ぎます。
- Server Component / Route Handler で Prisma を使うファイルでは、`export const runtime = "nodejs";` `export const dynamic = "force-dynamic";` `export const revalidate = 0;` のいずれか／組み合わせを明示し、Edge で実行されないようにしてください。
- Suspense / Streaming を利用するコンポーネントでは `cache` を使ったメモ化よりも、明示的に `prisma` を呼び出して SSR する方が安全です。
- トランザクションや大量クエリは Route Handler (`app/api/*`) でまとめて行い、Client Component からは API 経由でアクセスしてください。

### デプロイ後の確認チェックリスト
- `/settings/profile` `/explore` にアクセスして P2021 エラーが出ない。
- Vercel Build Logs に `prisma migrate deploy` と成功ログが含まれている。
- `User` `Profile` `Ranking` `Like` `Bookmark` テーブルが本番 DB に存在する (`psql` で `\dt` を確認)。
- Prisma Studio (`npx prisma studio`) でテーブルが参照できる。

### 障害継続時に確認すべきポイント
- `DATABASE_URL` がプレビュー / 本番で正しく切り替わっているか。
- `prisma/migrations` が最新化されているか (`git log` / `git status` を確認)。
- Vercel で旧キャッシュが残っていないか (`vercel --prod --force` で再デプロイ)。
- `lib/prisma.ts` が正しくインポートされ、他所で `new PrismaClient()` を直接生成していないか。

