"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from 'next-view-transitions';

export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Card className="w-[420px]">
        <CardHeader>
          <CardTitle>ページが見つかりませんでした</CardTitle>
          <CardDescription>
            お探しのページは存在しないか、削除された可能性があります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            URLが正しいかご確認ください。もしこれが間違いだと思われる場合は、お手数ですが管理者までご連絡ください。
          </p>
        </CardContent>
        <CardFooter className="gap-3">
          <Button asChild>
            <Link href="/home">チャット</Link>
          </Button>
          <Button variant={"secondary"} onClick={() => window.history.back()}>
            前のページに戻る
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
