import {NextResponse} from 'next/server';
import {turnstileConfig} from '@/lib/turnstile';

export function GET() {
  const headers={'Cache-Control':'no-store'};
  try {
    const config=turnstileConfig();
    return NextResponse.json({siteKey:config.siteKey,test:config.test},{headers});
  } catch {
    return NextResponse.json({error:'ログイン認証の設定が必要です。管理者はTurnstileの環境変数を確認してください。'},{status:503,headers});
  }
}
