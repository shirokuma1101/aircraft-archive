# Aircraft Archive

個人運営・一般公開のフライトログと航空写真サイト。Next.js / TypeScript / Directus / PostgreSQL。Ubuntu 24.04 + Docker Composeを想定しています。

## 実装内容

- 空港間の概略ルート地図、年・状態・便名・空港・機体番号による検索
- 搭乗予定・搭乗済み・欠航・未搭乗、予定到着後の実績入力待ち一覧
- 出発・到着空港の現地日時入力、UTC保存、空港のタイムゾーンで表示
- 写真の投稿・編集、カテゴリー・複数タグ、撮影場所、フライト・航空機との任意の関連付け
- 原本保存と縮小画像配信、写真ごとの公開・非公開
- 航空機・機種・航空会社・空港・機体番号と所属履歴の管理
- 機体番号と航空会社名はフライト・写真にも記録し、マスター更新後も当時の記録を保持
- 管理者専用ログイン（一般利用者の登録機能なし）

## Ubuntuで起動

Docker EngineとCompose v2をインストール済みのUbuntuで、プロジェクトを配置して実行します。

```bash
cp .env.example .env
```

`.env`の空欄を設定します。`SESSION_SECRET`、`DIRECTUS_SECRET`、`ARCHIVE_TOKEN`、`POSTGRES_PASSWORD`には、それぞれ異なる `openssl rand -hex 32` の値を使ってください。`ADMIN_EMAIL`と`ADMIN_PASSWORD`は管理者ログイン用です。秘密情報はGitに含めません。

```bash
docker compose up -d database directus
docker compose --profile setup run --rm init
docker compose up -d --build web
```

ローカルでは `http://localhost:12000`、管理画面は `/manage` です。Directus管理画面はホストの `http://localhost:12001` でのみ公開します。遠隔ホストではSSHポート転送を利用してください。

公開ページにはログインへのリンクを表示しません。管理者は `/manage` をブックマークして直接アクセスしてください。ログイン後のみヘッダーに管理画面とログアウトを表示します。管理ページには検索エンジン向けの `noindex, nofollow` を設定しています。認証と投稿権限の制限は引き続き有効です。

初回セットアップはDirectusの準備完了を最大約60秒待ちます。起動が遅い場合はログを確認して再実行してください。再実行は既存の記録を残し、不足するコレクション・フィールド・リレーションを追加します。既存フィールドの型変更を行うマイグレーション機能ではありません。

> この作業環境には検証用の `.env` を作成しています。本番では必ず本番専用の秘密値・管理者アカウントを設定してください。既存DBの管理者パスワードは環境変数を変えるだけでは更新されません。

## Cloudflare Tunnel

公開ホスト名の転送先を **`http://web:3000`** にします。Compose同梱のトンネルを使う場合:

1. Cloudflare側でトンネルと公開ホスト名を作成する。
2. `.env` の `APP_ORIGIN` を公開URL（例: `https://archive.example.com`、末尾スラッシュなし）に変更する。
3. `CLOUDFLARE_TUNNEL_TOKEN`を設定する。
4. `docker compose --profile tunnel up -d --build web tunnel` を実行する。

ホストOS上の既存cloudflaredなら転送先は `http://localhost:12000`。別のコンテナのcloudflaredなら同一ネットワークに参加させてください。`directus:8055`やPostgreSQLをTunnelで公開しないでください。

HTTPSのAPP_ORIGINではログインCookieにSecureを付けます。公開後はそのURLからログインしてください。書き込みAPIはOrigin一致を必須とします。CookieはHttpOnly・SameSite=Strict、暗号化され、有効期限は最大8時間です。期限後は再ログインします。

**CloudflareのCache Everything等を `/api/*`、`/manage*`、動的HTMLに適用しないでください。** 画像は毎回公開範囲を確認し `private, no-store` で返します。公開済みの画像を閲覧者が保存したコピーまで取り消すことはできません。

## 空港データの取込

```bash
docker compose --profile setup run --rm init node scripts/import-airports.mjs --apply
```

[OpenFlights](https://openflights.org/data)の `airports.dat` から空港レコードを取り込みます。IATAコードなし・小規模空港も含み、駅や港は除外します。名前、IATA/ICAOコード、国、緯度経度、IANAタイムゾーンを保存します。タイムゾーンが欠損または無効な場合だけtz-lookupで座標から補完し、補完対象は参照データ内の `inferred` に記録します。コードやタイムゾーンは管理画面で確認・修正できます。

`--apply` なしでは追加予定の確認だけを行います。通常の取込は既存レコードを上書き・削除せず、同じコードと位置で照合できる空港はスキップします。旧データを完全に置き換える場合は `--replace --apply` を指定します。新空港を登録し、フライト・写真の空港参照をICAO/IATAと位置で照合・付け替え・検証した後に旧空港を削除します。参照先が特定できない場合は変更前に停止します。バックアップと移行計画・結果は `.local/airport-migration-<日時>/` に保存します。途中で停止した場合も同じコマンドで再実行できます。置換中は管理画面からの編集を避けてください。

加工済み空港データは `public/openflights/airports.json`、出典は `AIRPORTS-NOTICE.txt`、ライセンスは `LICENSE.txt`（ODbL 1.0）として公開します。参照データにフライトや写真は含めません。Composeのinitでもこれらとバックアップをホストへ保存します。取込後は `docker compose build web` と `docker compose up -d --no-deps web` で公開ファイルを反映してください。ホストからは `node --env-file=.env scripts/import-airports.mjs --apply` を利用できます。

空港移行処理のテスト: `node --test tests/openflights-airports.test.mjs`。航空会社・機種の取込手順は以下を参照してください。便名からの実績自動取得は行いません。

## 最初の登録

### 航空会社・機種の公開データ取込

`node --env-file=.env scripts/import-openflights.mjs` でOpenFlightsの航空会社・機種データを取得して追加予定件数を確認し、`--apply` を付けて取り込みます。名前・ICAOコード・取込IDの一致を重複と判定し、既存レコードは上書きしません。再実行時も登録済みの項目はスキップします。IATAコードは歴史的に再利用されるため、それだけでは同一航空会社と判定しません。

過去の航空会社も含め、コードのない航空会社や不明・個人便の仮項目は除外します。航空会社は名前・IATA・ICAO、機種は名前・ICAOを登録します。取得元にメーカー専用列がないため、メーカーは推測しません。元データは随時更新のスナップショットで、現役／廃業の状態や最新のコードを保証しません。

出典：[OpenFlights](https://openflights.org/data)、ライセンス：[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)。出典、取得日時、ハッシュ、重複理由、取込前データは `.local/openflights-import-*.json` に保存します。加工済みの参照データとライセンスは `public/openflights/` に保存して同じライセンスで提供します（個人のフライト・写真は含みません）。フッターに出典・ライセンス・参照データへのリンクがあります。公開ファイルの更新をDocker版へ反映するにはWebの再ビルドが必要です。

### サンプルデータ

ローカル環境には画面確認用のサンプルを追加できます。

```bash
node --env-file=.env scripts/demo-data.mjs
```

架空のフライト12件・航空機2機・画像4枚（公開3枚／非公開1枚）を追加します。画像は実写ではなくサンプルイラストです。搭乗済み8件、実績入力待ち1件、将来の搭乗予定2件、欠航1件を含みます。判定基準となるサンプルの日付は2026年10月4日時点を想定しています。

追加したIDは `.local/demo-data.json` に記録します。このファイルを保持すれば、再実行時の重複追加を避けられます。サンプルだけを削除する場合は次を実行します。

```bash
node --env-file=.env scripts/demo-data.mjs --remove
```

削除対象は記録されたサンプルIDのみです。空港データは削除しません。サンプルを編集して本物の記録として利用した場合は、そのまま一括削除しないでください。

### 自分の記録を登録

1. `/manage` にログイン。
2. 空港を取込または手動登録。空港コード・緯度経度・IANAタイムゾーンを設定。
3. 必要に応じ航空会社 → 機種 → 航空機を登録。
4. フライトを登録。機体番号が不明でも保存できます。
5. 写真を投稿。カテゴリー・タグやフライトへの関連付けは任意です。

搭乗予定の到着日時を過ぎた便は管理画面で実績入力待ちになります。状態を搭乗済み・欠航・未搭乗に更新すると一覧から外れます。ページ読込時点で判定するため、開きっぱなしの場合は再読み込みしてください。実際の日時が不明なら未入力でも保存できます。

過去の機体を選択するときは「当時の機体番号」「当時の航空会社名」を確認してください。マスターからの補完は現在値であり、履歴の日付からの自動解決は行いません。夏時間終了の重複する現地時刻はdate-fns-tzの解釈を使用します。必要ならDirectusでUTCの値を確認・修正してください。

## 写真・アクセス制御

- JPEG / PNG / WebPの静止画、最大30MB・8,000万画素。実際の画像形式をsharpで検査します。
- 原本はDirectusのuploadsボリュームへ保存。縮小表示は640px・詳細表示は1600px以内。
- 原本ダウンロードは管理者限定。通常の公開写真は縮小版を閲覧できます。
- 写真詳細には原本から読み取ったEXIF（カメラ・レンズ・撮影日時・シャッター速度・絞り・ISO・焦点距離・露出補正・ホワイトバランス）を表示します。既存の写真も再投稿不要です。記録されていない項目は省略し、EXIFがない場合はその旨を表示します。GPSがあれば緯度・経度・地図を表示し、標高があれば併記します。公開写真のGPS位置情報も一般公開されます。非公開写真のEXIF・GPSは管理者だけが取得できます。所有者情報・シリアル番号は表示しません。EXIF日時は記録どおり表示し、タイムゾーンがなければ推測しません。
- 非公開画像・原本への匿名アクセスは404。写真IDから公開範囲を調べ、DirectusのファイルURLは公開しません。
- DirectusのPublic権限は付与しません。既存Directusを使う場合はPublic権限がないことを確認してください。
- サーバー専用のARCHIVE_TOKENはbootstrapで管理者に設定します。ブラウザーには送信しません。このトークンは強い権限を持つため厳密に管理してください。
- 写真の差し替えやフォームをキャンセルした際、以前のファイル・未使用のアップロードは残ります。Directusのファイル管理で、参照されていないことを確認して整理してください。
- 初期版のWeb画面には削除機能を設けていません。削除が必要な場合はDirectusで関連付けを確認して操作してください。

## 永続化とバックアップ

`database` と `uploads` の名前付きボリュームを利用します。`docker compose down -v` はデータを消すので実行しないでください。

Ubuntuでのバックアップ例（バックアップ中の書き込みを止めます）:

```bash
mkdir -p backups
docker compose stop web directus
docker compose exec -T database pg_dump -U archive -d archive > backups/database.sql
docker compose run --rm --no-deps --entrypoint tar directus -czf - -C /directus/uploads . > backups/uploads.tar.gz
docker compose start directus web
```

`.env`は別途安全に保管します。バックアップには非公開写真・ユーザー情報を含みます。復元時は対応するDirectusバージョンの空DBへSQLを読み込み、uploadsボリュームへ写真を戻し、同じ秘密値を設定します。本番運用前に別環境で復元を確認してください。

## ローカル開発・検証

Node.js 24とpnpm 11.19.0を利用します。

```bash
pnpm install --frozen-lockfile
pnpm bootstrap
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

実際のDirectusとブラウザーでの統合検証は、Webサイト起動後に `node --env-file=.env scripts/verify-integration.mjs` を実行します（ローカルURL限定）。WindowsではEdge、LinuxではPlaywrightのChromiumを利用し、`BROWSER_PATH`で実行ファイルを指定できます。検証で作ったレコードと画像のみ終了時に削除します。スクリーンショットは `.local/` に保存します。

`.env`のDirectusはローカルの8055番を指定します。`pnpm bootstrap`や空港取込は `.env` を読みます。Next.jsは起動時に自動で読み込みます。

## 構成

- `src/lib/schema.json`: 共有データ定義。フォーム・API検証・Directus初期化の元。
- `src/app/api`: 管理者認証、投稿、画像アップロード・配信。
- `src/components`: 地図、ログ、写真、管理フォーム。
- `scripts/bootstrap.mjs`: Directusスキーマ初期化。
- `scripts/import-airports.mjs`: 空港データ取込。

地図にはLeafletと[OpenStreetMap標準タイル](https://operations.osmfoundation.org/policies/tiles/)を利用します。帰属表示・通常のブラウザーキャッシュ・Referer送信を保ち、一括ダウンロードはしません。大量アクセス時は利用規約に合う商用タイル等への切替を検討してください。フォントはGoogle Fontsにアクセスし、取得できない場合はOSのフォントで表示します。

初期版は全記録をサーバーで読み込み、ブラウザーで検索します。数万件規模の利用ではページネーション・検索APIへの移行が必要です。

## フライトログのCSVインポート

管理者として `/manage` にログインし、フライト画面の「フライトをCSVからインポート」を開きます。

1. UTF-8・2MB以下・500件以内の見出し行付きCSVを読み込み、プレビューします。
2. 列の割り当てを確認します。myFlightradar24とOpenFlightsの一般的な列名を自動判定し、他のサービスや自作CSVも手動で割り当てられます。カンマ・セミコロン・タブに対応します。
3. 各行の「取込内容の確認・修正」で不足情報を補い、再検証します。空港は登録済みのIATA/ICAOコードまたは完全一致の名前で照合します。空港マスターへの自動追加はしません。
4. 対象行を選び、「公開して取り込む」を押します。フライトとメモは一般公開されます。

myFlightradar24は[公式のCSV出力画面](https://my.flightradar24.com/settings/export)から取得してください（[公式FAQ](https://my.flightradar24.com/about/faq)）。OpenFlightsは[公式CSV仕様](https://openflights.org/help/csv.php)に基づく見出しに対応します。OIDだけで空港名やコードのないCSV、年しかない日付は補完が必要です。汎用テンプレートは `/flight-import-template.csv` にあります。

時刻は空港の現地時刻として解釈します。myFlightradar24の搭乗済み記録は実際の出発・到着日時に保存し、予定日時は空欄にします。それ以外は予定日時として取り込みます。自動判別が合わない場合は「インポート元」で指定してください。出発日時と所要時間、または明示した到着日・日時が必要です。日付だけの記録を0時の便として保存することはありません。日時に `Z` または `+09:00` などのオフセットも指定できます。夏時間で重複する現地時刻にはオフセットが必要です。スラッシュ区切りの日付はMM/DD/YYYYです。状態がなければ到着日時から搭乗済み／搭乗予定に分類するので、プレビューで確認してください。

便名・出発空港・到着空港・出発日時が一致する行は重複としてスキップします。既存記録は更新しません。保存時にも再検証し、取込IDを固定することでタイムアウト後の再試行や同時送信による重複作成を防ぎます。エラー時には再プレビューして未登録の行だけを再実行できます。

航空会社名・機体番号はマスター未登録でも文字情報として保存し、機種名は公開メモに保持します。座席・クラス・メモも取り込みます。myFlightradar24のクラス1〜5はエコノミー／ビジネス／ファースト／エコノミー＋／プライベートに変換し、未知の値は保持します。割り当てのない列（独自ID・距離・旅行目的など）は保存しないため、必要ならメモに移してください。CSVに含まれるHTMLは実行しません。サービスへの直接ログイン、同期、HTML/PDFの取り込みには対応しません。

単体テスト: `pnpm test`。ローカルのDirectus・ブラウザーを使った検証: `node --env-file=.env scripts/verify-flight-import.mjs`（検証用フライトのみ終了時に削除）。

## ホストポート設定

aircraft-archiveは12000〜12999を使用します。Webは12000、Directusは12001です。既存.envのAPP_ORIGINとDIRECTUS_URLが旧ローカルURLの場合は.env.exampleに合わせて更新してください。ホスト側cloudflaredの転送先も12000に更新します。Compose内の通信先とdatabase/uploadsボリュームは維持します。反映にはdocker compose up -d --buildを使い、down -vは使用しません。

### 旧myFlightradar24データの実績移行（ローカル）

既存のインポート記録がmyFlightradar24由来であることを確認して使用します。先に `docker compose --profile setup run --rm init` でスキーマを更新し、更新版Webを起動してください。

```powershell
# 対象件数の確認
node --env-file=.env --import tsx scripts/migrate-myfr24.ts --confirm-myfr24
# 移行（.localに移行前データを保存し、変更後に整合性を検証）
node --env-file=.env --import tsx scripts/migrate-myfr24.ts --confirm-myfr24 --apply
```

ローカルDirectusだけが対象です。旧インポートIDと一致し、搭乗済みで実績未入力の記録に限り、予定日時を実績欄に移して予定欄を空にし、クラス名称とインポート元を保存します。移行済み記録や手入力記録は変更しません。

## 外部サイトへの埋め込み

管理画面の「埋め込みを作成」（`/manage/embeds`）で、集計カード・フライトマップ・最新の搭乗履歴から選択し、ライト／ダーク配色と対象年を設定できます。公開サイトURLにはCloudflare Tunnelなどの実際の公開URLを入力し、生成したiframeコードを外部サイトのHTML欄に貼り付けます。localhostは外部から閲覧できません。

公開エンドポイントは `/embed/summary`、`/embed/map`、`/embed/recent` です。`?theme=dark&year=2025` のように指定できます。搭乗済みフライトのみを集計し、再読み込み時に最新データを取得します。埋め込みはログイン状態に依存せず、写真・メモ・座席・管理情報を読み込みません。管理画面など通常ページは引き続き埋め込み禁止です。貼り付け先でiframeが許可されている必要があります。

## エクスポート


管理画面の「登録データをエクスポート」から、全フライトのCSVまたは全登録データのJSONをダウンロードできます。管理者ログインが必要です。画面の絞り込み条件には依存しません。CSVはUTF-8 BOM付きで、予定・実績日時を現地時刻とUTCオフセット付きで出力します。セル内の数式として解釈される文字列には先頭にアポストロフィを付けます。元の文字列やID・関連付けを保管する場合はJSONを使用してください。JSONには非公開写真の登録情報も含まれますが、画像ファイル自体・管理者アカウント・認証情報は含まれません。JSONの自動復元は未対応です。

## ログインのCloudflare Turnstile設定

ログイン画面 `/manage` はTurnstileの認証完了後に送信できます。ログインAPIもCloudflareのSiteverifyでトークンを検証し、本番ではホスト名と `action=login` を照合します。トークンなし・期限切れ・検証失敗・接続障害・キー未設定ではログインを許可しません。

本番公開前に [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/) でManagedウィジェットを作成し、公開ホスト名を登録してください。発行されたキーをサーバーの `.env` に保存します。シークレットキーはGitやチャットに貼り付けないでください。

```dotenv
APP_ORIGIN=https://your-public-host.example
TURNSTILE_MODE=production
TURNSTILE_SITE_KEY=発行されたサイトキー
TURNSTILE_SECRET_KEY=発行されたシークレットキー
```

設定後は `docker compose up -d --no-deps web` で反映します（設定変更のみならイメージ再ビルドは不要）。Directusは引き続き外部公開せず、TunnelはWebだけに接続してください。このTurnstileはWebのログインを保護し、Directusのログイン画面には適用されません。

ローカル開発では `APP_ORIGIN=http://localhost:12000` と `TURNSTILE_MODE=test` を指定すると、Cloudflare公式の成功用テストキーで実際のウィジェットとSiteverifyを確認できます。テストモードにはボット防御効果がありません。公開ホスト名でのテストモードと、本番モードでの公式テストキーはエラーにします。公開時は必ず本番モードと実キーへ変更してください。サイトキーだけを公開APIで返し、シークレットキーはサーバーからのみ使用します。

## サイトタイトルのユーザー名

管理画面の「サイト設定」で公開ユーザー名（1〜50文字）を保存すると、ブラウザーのタイトルが `Aircraft Archive — ユーザー名` になります。ログイン情報とは別にDirectusの `site_settings` に保存されます。既存環境では更新前に `pnpm bootstrap` で設定コレクションを追加してください。未設定時は `Aircraft Archive` と表示します。
