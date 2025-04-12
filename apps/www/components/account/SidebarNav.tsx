"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { User, Key, Shield, ArrowLeft, Book } from "lucide-react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { useAuth } from "@/context/AuthContext";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/avatar";
export const SidebarNav = () => {
  const t = useTranslations("account");
  const { user } = useAuth();
  const pathname = usePathname();

  const items = [
    {
      title: t("sidebarNav.account"),
      href: "/account",
      value: "/account",
      icon: <User className="h-4 w-4 mr-2" />,
    },
    {
      title: t("sidebarNav.password"),
      href: "/account/password",
      value: "/account/password",
      icon: <Key className="h-4 w-4 mr-2" />,
    },
    {
      title: t("sidebarNav.security"),
      href: "/account/security",
      value: "/account/security",
      icon: <Shield className="h-4 w-4 mr-2" />,
    },
  ];

  const bottomItems = [
    {
      title: "Voids API Docs",
      href: "https://voids.top/docs",
      value: "https://voids.top/docs",
      icon: <Book className="h-4 w-4 mr-2" />,
    },
    {
      title: t("layout.return"),
      href: "/home",
      value: "/home",
      icon: <ArrowLeft className="h-4 w-4 mr-2" />,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {user && (
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.photoURL || ""} />
            <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <p>{user.displayName}</p>
        </div>
      )}
      <Tabs defaultValue={pathname} className="w-full flex-grow" orientation="vertical">
        <TabsList className="flex flex-col bg-transparent space-y-2 w-full h-auto">
          {items.map((item) => (
            <TabsTrigger
              key={item.href}
              value={item.value}
              className="w-full justify-start py-2 px-3 text-md hover:bg-secondary transition-all duration-300"
              asChild
            >
              <Link href={item.href} className="flex items-center">
                {item.icon}
                <span>{item.title}</span>
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Tabs defaultValue={pathname} className="w-full flex-grow" orientation="vertical">
        <TabsList className="flex flex-col bg-transparent space-y-2 w-full h-auto mt-auto">
          {bottomItems.map((item) => (
            <TabsTrigger
              key={item.href}
              value={item.value}
              className="w-full justify-start py-2 px-3 text-md hover:bg-secondary transition-all duration-300"
              asChild
            >
              <Link href={item.href} className="flex items-center">
                {item.icon}
                <span>{item.title}</span>
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
