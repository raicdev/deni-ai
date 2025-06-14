"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Github,
  AlertCircle,
  Loader2,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import GitHubService, {
  GitHubRepository,
  FileChange,
} from "@/lib/github-service";
import type { User, UserIdentity } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@workspace/ui/components/alert";

// Import from absolute path instead of relative path
import { githubOAuth } from "@/lib/github-oauth";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

// Define the GitHubOAuthResult interface locally
interface GitHubOAuthResult {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

interface GitHubIntegrationProps {
  chatId: string;
  onActionComplete?: (
    success: boolean,
    pullRequestUrl?: string,
    error?: any,
  ) => void;
  triggerButton?: React.ReactNode;
}

interface GitHubSettings {
  selectedRepository: GitHubRepository | null;
  branchName: string;
  commitMessage: string;
  pullRequestTitle: string;
  pullRequestDescription: string;
}

export function GitHubIntegration({
  chatId,
  onActionComplete,
  triggerButton,
}: GitHubIntegrationProps) {
  const t = useTranslations("githubIntegration");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"auth" | "setup" | "review" | "creating">(
    "auth",
  );

  const [settings, setSettings] = useState<GitHubSettings>({
    selectedRepository: null,
    branchName: "",
    commitMessage: "",
    pullRequestTitle: "",
    pullRequestDescription: "",
  });

  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [gitHubService, setGitHubService] = useState<GitHubService | null>(
    null,
  );
  const [reauthorizeRequired, setReauthorizeRequired] = useState(true);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [identities, setIdentities] = useState<UserIdentity[]>([]);

  const { user, supabase } = useAuth();

  useEffect(() => {
    const fetchIdentities = async () => {
      if (!supabase) return;

      try {
        const { data, error } = await supabase.auth.getUserIdentities();
        if (error) {
          console.error("Error fetching identities:", error);
          return;
        }
        setIdentities(data.identities || []);
      } catch (err) {
        console.error("Error fetching identities:", err);
      }
    };
    fetchIdentities();
  }, [supabase]);

  useEffect(() => {
    if (step != "auth") return;
    const getToken = async () => {
      if (!user || !supabase) return;

      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.provider_token;
      if (!accessToken) {
        setReauthorizeRequired(true);
        return;
      }

      try {
        // Check if GitHub is already linked
        const existingIdentity = identities.find(
          (identity) => identity.provider === "github",
        );

        if (existingIdentity) {
          // Use existing access token if available
          if (accessToken) {
            setGitHubService(new GitHubService(accessToken));
            setStep("setup");
          } else {
            // If no stored token, prompt to link again
            setStep("auth");
          }
        } else {
          // If not linked, prompt to link GitHub account
          setStep("auth");
        }
      } catch (err: any) {
        console.error("Error initializing GitHub service:", err);
        setError(`${t("errors.initializeFailed")}: ${err.message}`);
      }
    };

    getToken();
  }, [user, supabase, step]);

  // Load repositories when GitHub service is available
  useEffect(() => {
    if (gitHubService) {
      loadRepositories();
    }
  }, [gitHubService]);
  const loadRepositories = async () => {
    if (!gitHubService) return;

    setIsLoading(true);
    try {
      const repos = await gitHubService.getUserRepositories();
      // Ensure repos is always an array
      setRepositories(Array.isArray(repos) ? repos : []);
      setError(null);
    } catch (err: any) {
      setError(`${t("errors.loadRepositoriesFailed")}: ${err.message}`);
      setRepositories([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFileChanges = async () => {
    setIsLoading(true);
    try {
      // Extract files from WebContainer
      const files = await GitHubService.extractWebContainerFiles(chatId);
      setFileChanges(files);

      // Generate default values
      const generatedBranchName = GitHubService.generateBranchName();
      const generatedCommitMessage = GitHubService.generateCommitMessage(
        files.length,
      );
      const generatedPRDescription =
        GitHubService.generatePullRequestBody(files);

      setSettings((prev) => ({
        ...prev,
        branchName: generatedBranchName,
        commitMessage: generatedCommitMessage,
        pullRequestTitle: `WebContainer changes (${files.length} files)`,
        pullRequestDescription: generatedPRDescription,
      }));
      setError(null);
    } catch (err: any) {
      setError(`${t("errors.extractFailed")}: ${err.message}`);
      setFileChanges([]);
    } finally {
      setIsLoading(false);
    }
  };
  const handleRepositorySelect = (repoFullName: string) => {
    // Ensure repositories is an array before using find
    const reposArray = Array.isArray(repositories) ? repositories : [];
    const selectedRepo = reposArray.find(
      (repo) => repo.full_name === repoFullName,
    );
    setSettings((prev) => ({
      ...prev,
      selectedRepository: selectedRepo || null,
    }));
  };
  const handleNextStep = async () => {
    if (step === "setup") {
      if (!settings.selectedRepository) {
        setError(t("errors.selectRepository"));
        return;
      }

      await loadFileChanges();
      setStep("review");
    } else if (step === "review") {
      await createPullRequest();
    }
  };
  const createPullRequest = async () => {
    if (!gitHubService || !settings.selectedRepository) return;

    setStep("creating");
    setIsLoading(true);

    try {
      const repo = settings.selectedRepository;
      const [owner, repoName] = repo.full_name.split("/");

      // Validate required settings
      if (
        !owner ||
        !repoName ||
        !settings.branchName ||
        !settings.commitMessage ||
        !settings.pullRequestTitle
      ) {
        throw new Error(t("errors.missingSettings"));
      }

      // Check if branch already exists
      const branchExists = await gitHubService.checkBranchExists(
        owner,
        repoName,
        settings.branchName,
      );
      if (branchExists) {
        throw new Error(
          t("errors.branchExists", { branchName: settings.branchName }),
        );
      }

      // Create branch
      await gitHubService.createBranch(
        owner,
        repoName,
        settings.branchName,
        repo.default_branch,
      );

      // Commit files to the new branch
      if (fileChanges.length > 0) {
        await gitHubService.commitFiles(
          owner,
          repoName,
          settings.branchName,
          fileChanges,
          settings.commitMessage,
        );
      }

      // Create pull request
      const pullRequest = await gitHubService.createPullRequest(
        owner,
        repoName,
        {
          title: "[Intellipulse] " + settings.pullRequestTitle,
          body: settings.pullRequestDescription,
          head: settings.branchName,
          base: repo.default_branch,
        },
      );
      toast.success(t("success.pullRequestCreated"));
      onActionComplete?.(true, pullRequest.html_url);
      setIsOpen(false);
      resetState();
    } catch (err: any) {
      console.error("Error creating pull request:", err);
      setError(`${t("errors.createFailed")}: ${err.message}`);
      toast.error(t("errors.createFailed"));
      onActionComplete?.(false);
    } finally {
      setIsLoading(false);
      setStep("setup");
    }
  };
  const resetState = () => {
    setStep("auth");
    setSettings({
      selectedRepository: null,
      branchName: "",
      commitMessage: "",
      pullRequestTitle: "",
      pullRequestDescription: "",
    });
    setRepositories([]);
    setFileChanges([]);
    setError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    resetState();
  };
  const canProceed = () => {
    if (step === "auth") {
      return !isLoading;
    }
    if (step === "setup") {
      return settings.selectedRepository && !isLoading;
    }
    if (step === "review") {
      return (
        settings.branchName &&
        settings.commitMessage &&
        settings.pullRequestTitle &&
        !isLoading
      );
    }
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm">
            <Github className="w-4 h-4 mr-2" />
            {t("button")}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        {" "}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}{" "}
        {/* Authentication Step */}
        {step === "auth" &&
          !identities.find((identity) => identity.provider === "github") && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {t("auth.linkRequired")}
                </h3>
                <p className="text-muted-foreground">
                  {t("auth.linkMessage")}
                  <br />
                  {t("auth.linkSubMessage")}
                </p>
              </div>

              <Button asChild>
                <Link href="/account" onClick={() => setIsOpen(false)}>
                  <ShieldCheck className="w-4 h-4" />
                  {t("auth.accountManager")}
                </Link>
              </Button>
            </div>
          )}
        {/* Reauthorization Step */}
        {step === "auth" &&
          identities.find((identity) => identity.provider === "github") &&
          reauthorizeRequired && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {t("auth.reauthorizationRequired")}
                </h3>
                <p className="text-muted-foreground">
                  {t("auth.reauthorizationMessage")}
                </p>
              </div>

              <Button
                onClick={async () => {
                  try {
                    const result = await githubOAuth.signInWithGitHubPopup();

                    if (result) {
                      setGitHubService(new GitHubService(result.accessToken));
                      setReauthorizeRequired(false);
                    }
                  } catch (error) {
                    console.error("Reauthorization failed:", error);
                    toast.error(t("errors.reauthorizationFailed"));
                  }
                }}
              >
                {t("auth.reauthorizeButton")}
              </Button>
            </div>
          )}
        {step === "auth" &&
          identities.find((identity) => identity.provider === "github") &&
          !reauthorizeRequired && (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  {t("auth.accountLinked")}
                </h3>
              </div>

              <Button onClick={() => setStep("setup")}>
                {t("auth.proceed")}
              </Button>
            </div>
          )}
        {/* Setup Step */}
        {step === "setup" && (
          <div className="space-y-4">
            {user && (
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <img
                    src={user.user_metadata.avatar_url || "/github-icon.png"}
                    alt="User avatar"
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm font-medium">
                    {user.user_metadata.display_name || user.email}
                  </span>
                </div>{" "}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => supabase?.auth.signOut()}
                >
                  {t("setup.signOut")}
                </Button>
              </div>
            )}{" "}
            {gitHubService && (
              <div className="space-y-2">
                <Label htmlFor="repository">{t("setup.repository")}</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {settings.selectedRepository
                        ? settings.selectedRepository.full_name
                        : t("setup.selectRepository")}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full min-w-[400px]">
                    {Array.isArray(repositories) &&
                      repositories.map((repo) => (
                        <DropdownMenuItem
                          key={repo.id}
                          onClick={() => handleRepositorySelect(repo.full_name)}
                        >
                          <div className="flex items-center gap-2">
                            <span>{repo.full_name}</span>{" "}
                            {repo.private && (
                              <span className="text-xs bg-muted px-1 rounded">
                                {t("setup.private")}
                              </span>
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>{" "}
                </DropdownMenu>{" "}
                {Array.isArray(repositories) &&
                  repositories.length === 0 &&
                  !isLoading && (
                    <p className="text-xs text-muted-foreground">
                      {t("setup.noRepositories")}
                    </p>
                  )}
              </div>
            )}
          </div>
        )}
        {/* Review Step */}
        {step === "review" && (
          <div className="space-y-4">
            {" "}
            {fileChanges.length > 0 ? (
              <div className="space-y-2">
                <Label>
                  {t("review.filesToChange")} ({fileChanges.length})
                </Label>
                <div className="max-h-32 overflow-y-auto border rounded p-2 bg-muted/20">
                  {fileChanges.map((file, index) => (
                    <div
                      key={index}
                      className="text-sm flex items-center gap-2"
                    >
                      <span
                        className={`text-xs px-1 rounded ${
                          file.operation === "create"
                            ? "bg-green-100 text-green-800"
                            : file.operation === "update"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {t(`operations.${file.operation}`)}
                      </span>
                      <span className="font-mono">{file.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t("review.noChanges")}</AlertDescription>
              </Alert>
            )}{" "}
            <div className="space-y-2">
              <Label htmlFor="branch-name">{t("review.branchName")}</Label>
              <Input
                id="branch-name"
                value={settings.branchName}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    branchName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commit-message">
                {t("review.commitMessage")}
              </Label>
              <Input
                id="commit-message"
                value={settings.commitMessage}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    commitMessage: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-title">{t("review.pullRequestTitle")}</Label>
              <Input
                id="pr-title"
                value={settings.pullRequestTitle}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    pullRequestTitle: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-description">
                {t("review.pullRequestDescription")}
              </Label>
              <Textarea
                id="pr-description"
                rows={4}
                value={settings.pullRequestDescription}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    pullRequestDescription: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        )}
        {/* Creating Step */}{" "}
        {step === "creating" && (
          <div className="text-center py-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto" />
            <div>
              <p className="font-medium">{t("creating.title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("creating.subtitle")}
              </p>
            </div>
          </div>
        )}{" "}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t("buttons.cancel")}
          </Button>
          {step === "auth" && (
            <Button onClick={() => setStep("setup")} disabled={isLoading}>
              {t("buttons.continueToSetup")}
            </Button>
          )}
          {step === "setup" && (
            <Button onClick={handleNextStep} disabled={!canProceed()}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("buttons.next")}
            </Button>
          )}
          {step === "review" && (
            <Button onClick={handleNextStep} disabled={!canProceed()}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("buttons.createPullRequest")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GitHubIntegration;
