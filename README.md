# AmiVoice Recognize by Twilio

アドバンスト・メディア社の音声認識サービスである AMIVoice Cloud Platform を使って、Twilio 上で録音されたデータを音声認識させる方法を解説します。

## AmiVoice Cloud Platform とは

_以下、[ホームページ](https://acp.amivoice.com/main/)より抜粋_

AmiVoice Cloud Platform が提供する音声認識 API は、音声認識機能（リアルタイム認識・バッチ認識）を Web サイトや Web アプリケーション、スマートフォンアプリ等に実装する為の開発ツールです。音声文字化や音声対話、音声制御などの各種音声認識サービスにご使用頂けます。  
AmiVoice は、音声認識市場シェア No.1 の、話し言葉に強い音声認識エンジンです。会議の書き起こしや音声入力、電話音声の文字起こしなど幅広い用途でお使い頂けます。

## 準備

### AmiVoice のセットアップ

今回は AmiVoice Cloud Platform を利用しますので、まずは AmiVoice のアカウントが必要です。[こちらの申込フロー](https://acp.amivoice.com/account/regist.php)に従ってユーザー登録をしましょう。  
一部のエンジンについては、毎月 60 分までの無料枠が用意されています。  
今回は無料枠が用意されている**会話\_汎用（ログ保存あり）**プランを利用します。このプランでは、毎月 60 分を超えると 0.025 円/秒がかかります。**会話\_汎用（ログ保存なし）**プランだと、0.04 円/秒となります。  
ログ保存ありプランでは、会話データがアドバンスト・メディア社内に保存され、今後の認識率向上に利用されます。セキュリティ上、ログの保存を望まないのであればログ保存なしプランにすると良いでしょう。

ユーザー登録が完了すると、**APPKEY** が発行されるので、そちらを控えておきます。  
また、それぞれのプランごとの**接続エンジン名**と**HTTP 音声認識 API**の URL が用意されるので、そちらも合わせて控えておいてください。

![AmiVoice設定情報.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/4f4738d0-f32c-b39b-2471-351f59fe997d.png)

### Twilio アカウントと電話番号

もちろん、Twilio のアカウントも必要です。また、電話番号も必要ですので、まだ取得していない方は[こちら](https://cloudapi.kddi-web.com/signup)からアカウントを作成してください。  
日本の 050 番号を取得するには、Bundles の登録も必要となります。詳しくは以下の記事をご覧ください。

- [Twilio で Bundles（本人認証）の設定を行う（個人編）](https://qiita.com/mobilebiz/items/579d1920a8b0bca96459)
- [Twilio で Bundles（本人認証）の設定を行う（法人編）](https://qiita.com/mobilebiz/items/4d09a15a355ae5df3d24)

### Twilio CLI

今回は（も）、Twilio CLI とサーバーレスプラグインを使っていきます。まだ CLI の準備ができていない方は、以下の記事をみてセットアップをしておいてください。

- [Twilio CLI（セットアップ編）](https://qiita.com/mobilebiz/items/456ce8b455f6aa84cc1e)
- [Twilio CLI（サーバーレス開発編）](https://qiita.com/mobilebiz/items/fb4439bf162098e345ae)

## ハンズオン

### ソースコードの準備

- 適当な作業ディレクトリに移動して、以下のコマンドを使ってソースコード一式をダウンロードします。

```sh
git clone https://github.com/mobilebiz/amivoice-recognize.git
```

- 環境ファイルを準備します。

```sh
cd amivoice-recognize
cp .env.sample .env
```

- コピーした`.env`をエディタで開き、以下の内容を更新します。

| 項目        | 内容                                           |
| :---------- | :--------------------------------------------- |
| ACCOUNT_SID | Twilio のアカウント SID（AC から始まる文字列） |
| AUTH_TOKEN  | 同じく Twilio の Auth Token                    |
| AMI_APP_KEY | AmiVoice で発行された APPKEY                   |
| AMI_ENGINE  | 先程控えておいたエンジン名                     |
| AMI_URL     | 同じく HTTP 音声認識 API                       |

## プログラムの解説

今回のソースコードでは、`functions/ami/recognize.js` が API のやり取りをしているコードになります。

```javascript:recognize.js
const axios = require("axios");
const FormData = require("form-data");

exports.handler = async function (context, event, callback) {
  console.log("Recognize start.");
  try {
    const data = new FormData();

    // Download from Twilio
    const res = await axios({
      method: "GET",
      url: `${event.RecordingUrl}.wav`,
      responseType: "stream",
      auth: {
        username: context.ACCOUNT_SID,
        password: context.AUTH_TOKEN,
      },
    });

    // Send to AMI Voice
    data.append("u", context.AMI_APP_KEY);
    data.append("d", `grammarFileNames=${context.AMI_ENGINE}`);
    data.append("c", "8k");
    data.append("a", res.data);
    const config = {
      method: "post",
      url: `${context.AMI_URL}`,
      headers: {
        ...data.getHeaders(),
      },
      data: data,
    };
    const result = await axios(config);
    console.log(`Recognize completed.`);
    console.dir(result.data);
    callback(null, {
      text: result.data.text,
    });
  } catch (err) {
    callback(err);
  }
};
```

このコードは、Twilio 上で録音が完了したときに呼び出されることを想定しています。  
前半部分は、Twilio 上の録音データを取得するコードになっています。録音データの URL は `RecordingUrl` パラメータとして渡されます。このパラメータに拡張子をつけることによって、 wav もしくは mp3 ファイルとしてダウンロードすることができます。  
また、axios のパラメータで `responseType: "stream"` を指定するところも重要です。こうすることによって、ローカルに録音データを保存せずに、そのまま AmiVoice に渡すことが可能になります。

後半部分では、AmiVoice Cloud Platform を呼び出しています。  
今回は**会話\_汎用（ログ保存あり）**プランを利用する設定になっていますので、これ以外のプランを利用する場合のパラメータについては AmiVoice のドキュメントを参照ください。

音声認識が正常に完了すると、戻り値の `text` パラメータに結果が入りますので、このプログラムではそれを JSON 形式で返却しています。

**重要**  
Twilio Functions では、タイムアウト値が 10 秒となっているため、録音データが長いと認識結果が戻る前にタイムアウトになってしまうことが予想されます。 その場合は、Twilio Functions ではなく、AWS Lambda など、タイムアウト値が長く設定できるサービスを選択してください。

### デプロイ

デプロイするときは、Twilio CLI プロファイルが対象の Twilio プロジェクトのものであることを確認してください。  
違うプロファイルでデプロイをすると、間違ったプロジェクト内に Functions ができてしまいます。プロファイルを切り替えるときは、twilio profiles:use プロファイル名で行います。

- 以下のコマンドでデプロイします。

```sh
twilio serverless:deploy --force
```

- 以下のようなにデプロイされれば成功です。

```sh
Deploying functions & assets to the Twilio Runtime

Account         ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Token           28e7****************************
Service Name    amivoice-recognize
Environment     dev
Root Directory  /Users/katsumi/Documents/workspace/AMIVoice/amivoice-recognize
Dependencies    axios, form-data, twilio
Env Variables   AMI_APP_KEY, AMI_ENGINE, AMI_URL
Runtime         undefined

✔ Serverless project successfully deployed

Deployment Details
Domain: amivoice-recognize-XXXX-dev.twil.io
Service:
   amivoice-recognize (ZSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
Environment:
   dev (ZExxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
Build SID:
   ZBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Runtime:
   node12
View Live Logs:
   https://www.twilio.com/console/assets/api/ZSxxxxxxxxxxxxxxxxxxxxxx/environment/ZExxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Functions:
   https://amivoice-recognize-XXXX-dev.twil.io/ami/recognize
Assets:

```

## Studio で録音フローを作る

- Twilio の管理コンソールに[ログイン](https://jp.twilio.com/login/kddi-web)します。
- Studio メニューに移動します。
- **Create a flow** ボタンを押します。
  ![CreateFlow.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/4b358128-4a59-8b09-8059-fe96425a5978.png)

- **FLOW NAME** に「AMI」と入力します。
  ![スクリーンショット 2021-04-21 16.33.59.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/14d54120-9a61-a076-a555-fca26ee1e149.png)

- **Next** ボタンを押します。
- テンプレートの一覧が表示されるので、下までスクロールして **Import from JSON** を選択します。
  ![ImportFromJSON.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/d1e878dc-0033-8771-a8f0-cd85036356f0.png)

- **Next** ボタンを押します。
- JSON を貼り付ける画面が表示されるので、以下の JSON を貼り付けます。このとき、すでに入力されている `{}` は削除してから貼り付けてください。

```json
{
  "description": "AMIVoice Recognize",
  "states": [
    {
      "name": "Trigger",
      "type": "trigger",
      "transitions": [
        {
          "event": "incomingMessage"
        },
        {
          "next": "RecordingGuide",
          "event": "incomingCall"
        },
        {
          "event": "incomingRequest"
        }
      ],
      "properties": {
        "offset": {
          "x": -120,
          "y": 60
        }
      }
    },
    {
      "name": "RecordingGuide",
      "type": "say-play",
      "transitions": [
        {
          "next": "Recording",
          "event": "audioComplete"
        }
      ],
      "properties": {
        "voice": "Polly.Mizuki",
        "offset": {
          "x": -60,
          "y": 240
        },
        "loop": 1,
        "say": "ただいま電話に出ることができません。お手数ですが発信音のあとに30秒以内でメッセージをお願いします。終わりましたら、最後にシャープを押してください。では、どうぞ。",
        "language": "ja-JP"
      }
    },
    {
      "name": "Recording",
      "type": "record-voicemail",
      "transitions": [
        {
          "next": "Recognize",
          "event": "recordingComplete"
        },
        {
          "event": "noAudio"
        },
        {
          "event": "hangup"
        }
      ],
      "properties": {
        "transcribe": false,
        "offset": {
          "x": -60,
          "y": 470
        },
        "trim": "trim-silence",
        "play_beep": "true",
        "finish_on_key": "#",
        "timeout": 5,
        "max_length": 30
      }
    },
    {
      "name": "Recognize",
      "type": "run-function",
      "transitions": [
        {
          "next": "Replay",
          "event": "success"
        },
        {
          "event": "fail"
        }
      ],
      "properties": {
        "service_sid": "",
        "environment_sid": "",
        "offset": {
          "x": -60,
          "y": 700
        },
        "function_sid": "",
        "parameters": [
          {
            "value": "{{widgets.Recording.RecordingUrl}}",
            "key": "RecordingUrl"
          }
        ],
        "url": "https://amivoice-recognize-XXXX-dev.twil.io/ami/recognize"
      }
    },
    {
      "name": "Replay",
      "type": "say-play",
      "transitions": [
        {
          "event": "audioComplete"
        }
      ],
      "properties": {
        "voice": "Polly.Mizuki",
        "offset": {
          "x": -60,
          "y": 930
        },
        "loop": 1,
        "say": "{{widgets.Recognize.parsed.text}}",
        "language": "ja-JP"
      }
    }
  ],
  "initial_state": "Trigger",
  "flags": {
    "allow_concurrent_calls": true
  }
}
```

![スクリーンショット 2021-04-21 16.39.49.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/9caef501-a059-601d-5b36-d0c2faa6711a.png)

- **Next** ボタンを押します。
- 以下のようなフローが表示されます。
  ![Flow.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/5217fd6a-1c53-369a-dc85-690b9ce69ea7.png)

- 左側のキャンパスで、**Recognize** ウィジェットを選択します。
- 右側にプロパティページが表示されます。
- **SERVICE** のプルダウンリストから「amivoice-recognize」を選択します。
- **ENVIRONMENT** のプルダウンリストから「dev-environment」を選択します。
- **FUNCTION** のプルダウンリストから「/ami/recognize」を選択します。
- **Save**ボタンを押します。

### フローの解説

- 着信したコールは **Trigger** ウィジェットの **Incoming Call** から入ってきます。
- 次に、**RecordingGuide** ウィジェットで録音をお願いするメッセージを流しています。
- 実際に録音をするのが、**Recording** ウィジェットです。#（シャープ）が押されたら録音を終了する設定（**STOP RECORDING ON KEYPRESS**）、録音の前後の無音をカットする設定（**TRIM**）、ブザー音を流してから録音する設定（**PLAY BEEP**）がされています。
  ![スクリーンショット 2021-04-22 7.26.33.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/eac709c7-8c68-aec8-9872-67804a72a495.png)

- 録音が完了すると、**Recognize** ウィジェットに接続され、このウィジェットが先程のプログラムをコールしています。
- 最後の **Replay** ウィジェットでは、**Recognize** ウィジェットの戻り値である text を受け取って、それを音声合成で流します。

では最後にパブリッシュしましょう。

![Publish.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/1970b19b-cf97-4b85-6f5b-aef42b621eed.png)

- 画面上部にある **Publish** ボタンを押します。
  ![スクリーンショット 2021-04-21 16.50.46.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/22ed3439-eda1-50ba-e85f-87ae8576f54a.png)

- **Publish** ボタンを押します。

### 電話番号の設定

- Twilio 管理コンソールで **Phone Numbers** メニューに移動します。
- 購入済みの電話番号を選択して設定ページに移動します。
  ![PhoneNumberConfig.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/86046/8344ccd8-e906-e383-6481-e8520e436d7d.png)

- **Voice & Fax** セクションの中にある **A CALL COMES IN** の設定で、プルダウンから「Studio Flow」を選択し、さらに右側のプルダウンから「AMI」を選択します。
- **Save** ボタンを押します。

### テスト

では実際に先程設定した電話番号に電話をかけてみます。  
ガイダンスが流れたあと、なにか適当にメッセージを入れて最後に＃を押します。  
その後しばらくすると録音した内容が女性の声で再生されれば成功です。

## まとめ

Twilio を使ったシステムでは、今回のような音声認識を使うケースも多く見られます。  
よく使われるのが、 Google の Speech-to-text や IBM Watson 、Amazon Transcribe などですが、日本語の認識では今回の AmiVoice もかなり精度が高いです。  
さらに、AmiVoice では実際に発話された秒での課金になりますので、無音部分には課金されません。その他にも単語登録の機能や、医療・製薬・保険・金融といった専用のエンジンも用意されているため、ビジネスユースに強いという特長があります。

音声認識を利用する場合は、ぜひ候補の一つとして検討してみてください。  
それでは素敵な Twilio ライフを。
