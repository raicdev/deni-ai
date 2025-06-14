"use client";

import { useSettings } from "@/hooks/use-settings";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu";
import { Switch } from "@workspace/ui/components/switch";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  useParams,
  useRouter as nextRouter,
  usePathname,
} from "next/navigation";
import { useEffect, useState } from "react";
import UsageSettings from "./UsageSettings";

export default function GeneralSettings() {
  const { setTheme, theme } = useTheme();
  const t = useTranslations();
  const params = useParams();
  const language = params.locale === "ja" ? "ja" : "en";
  const NextRouter = nextRouter();
  const pathname = usePathname();
  const { settings, updateSetting } = useSettings();

  return (
    <div className="space-y-6">
      <div className="bg-card/50 border border-border/30 rounded-md overflow-hidden">
        <div className="flex p-5 items-center gap-4">
          <div className="flex-grow">
            <h3 className="text-lg font-bold">
              {t("settings.general.theme.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("settings.general.theme.description")}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {t("settings.general.theme.action")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                {t("common.themes.light")}{" "}
                {theme === "light" && <Check className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                {t("common.themes.dark")}{" "}
                {theme === "dark" && <Check className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                {t("settings.general.theme.system")}{" "}
                {theme === "system" && <Check className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="bg-card/50 border border-border/30 rounded-md overflow-hidden">
        <div className="flex p-5 items-center gap-4">
          <div className="flex-grow">
            <h3 className="text-lg font-bold">
              {t("settings.general.language.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("settings.general.language.description")}
            </p>
          </div>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {t("settings.general.language.action")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    NextRouter.push(pathname.replace("/" + language, "/ja"));
                  }}
                >
                  {"Japanese - 日本語"}{" "}
                  {language === "ja" && <Check className="ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    NextRouter.push(pathname.replace("/" + language, "/en"));
                  }}
                >
                  {"English - 英語"}{" "}
                  {language === "en" && <Check className="ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Usage Statistics Section */}
      <UsageSettings />
    </div>
  );
}
