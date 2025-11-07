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
