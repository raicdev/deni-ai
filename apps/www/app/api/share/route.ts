import { authAdmin, notAvailable, firestoreAdmin } from "@workspace/firebase-config/server";
import { NextResponse } from "next/server";
import { UIMessage } from "ai";

interface ShareRequest {
  sessionId: string;
  title: string;
  messages: UIMessage[];
}

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get("Authorization");
    
    if (!authorization || notAvailable) {
      return NextResponse.json({ error: "Authorization Failed" }, { status: 401 });
    }

    let userId: string;
    try {
      const decodedToken = await authAdmin?.verifyIdToken(authorization);
      if (!decodedToken) {
        return NextResponse.json({ error: "Authorization Failed" }, { status: 401 });
      }
      userId = decodedToken.uid;
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: "Authorization Failed" }, { status: 401 });
    }

    const { sessionId, title, messages }: ShareRequest = await req.json();

    if (!sessionId || !title || !messages || messages.length === 0) {
      return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }

    // 共有IDを生成（ランダムなID）
    const shareId = crypto.randomUUID();

    // Firestoreに共有データを保存
    if (!firestoreAdmin) {
      return NextResponse.json({ error: "Firebase is not available" }, { status: 500 });
    }
    
    const sharedChatRef = firestoreAdmin.collection("shared-conversations").doc(shareId);
    await sharedChatRef.set({
      sessionId,
      title,
      messages,
      userId,
      createdAt: new Date(),
      viewCount: 0,
    });

    return NextResponse.json({ 
      success: true, 
      shareId,
      shareUrl: `/shared/${shareId}`
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get("id");

    if (!shareId) {
      return NextResponse.json({ error: "Share ID is not specified" }, { status: 400 });
    }

    // Firestoreから共有データを取得
    if (!firestoreAdmin) {
      return NextResponse.json({ error: "Firebase is not available" }, { status: 500 });
    }
    
    const sharedChatRef = firestoreAdmin.collection("shared-conversations").doc(shareId);
    const sharedChatDoc = await sharedChatRef.get();

    if (!sharedChatDoc.exists) {
      return NextResponse.json({ error: "Specified shared chat not found" }, { status: 404 });
    }

    const sharedChatData = sharedChatDoc.data();

    // 閲覧数をインクリメント
    await sharedChatRef.set({
      ...sharedChatData,
      viewCount: (sharedChatData?.viewCount || 0) + 1,
    }, { merge: true });

    // Firestoreのタイムスタンプをシリアライズ可能な形式に変換
    const createdAt = sharedChatData?.createdAt;
    const createdAtDate = createdAt && typeof createdAt.toDate === 'function'
      ? createdAt.toDate().toISOString()
      : new Date().toISOString();

    return NextResponse.json({
      success: true,
      data: {
        title: sharedChatData?.title,
        messages: sharedChatData?.messages,
        createdAt: createdAtDate,
        viewCount: (sharedChatData?.viewCount || 0) + 1,
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}