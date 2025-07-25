"use client";

import { useState, useEffect } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Plus, FolderOpen, Eye, FileText } from "lucide-react";
import { useSupabase } from "@/context/supabase-context";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

interface ClientHub {
  id: string;
  name: string;
  description: string;
  files: any[];
  created_by: {
    name: string;
    verified: boolean;
    id: string;
  };
  created_at: number;
}

export default function HubsPage() {
  const [hubs, setHubs] = useState<ClientHub[]>([]);
  const { user, secureFetch, loading } = useSupabase();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newHub, setNewHub] = useState({ name: "", description: "" });

  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    fetchHubs();
  }, [loading, user]);

  const fetchHubs = async () => {
    try {
      const response = await secureFetch("/api/hubs");
      if (response.ok) {
        const data = await response.json();
        if (!data.success) return;

        setHubs(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch hubs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createHub = async () => {
    try {
      const response = await secureFetch("/api/hubs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newHub),
      });

      if (response.ok) {
        const createdHub = await response.json();
        if (!createdHub.success) return;

        router.push(`/hubs/${createdHub.hubId}`);
        setIsCreateDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to create hub:", error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Hubs</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Hub
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Hub</DialogTitle>
              <DialogDescription>
                Create a new hub to organize your files and collaborate.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newHub.name}
                  onChange={(e) =>
                    setNewHub({ ...newHub, name: e.target.value })
                  }
                  placeholder="Enter hub name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newHub.description}
                  onChange={(e) =>
                    setNewHub({ ...newHub, description: e.target.value })
                  }
                  placeholder="Enter hub description"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={createHub}
                disabled={!newHub.name.trim() || !newHub.description.trim()}
              >
                Create Hub
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading || loading || !hubs ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : hubs.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No hubs yet</h3>
          <p className="text-muted-foreground mb-4">
            Get started by creating your first hub to organize files and
            collaborate.
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Hub
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hubs.map((hub) => (
            <Card key={hub.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  {hub.name}
                </CardTitle>
                <CardDescription>{hub.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <FileText className="w-4 h-4" />
                  {hub.files.length} files
                </div>
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(hub.created_at).toLocaleDateString()}
                </p>
              </CardContent>
              <CardFooter className="flex gap-2 mt-auto">
                <Button variant="outline" asChild>
                  <Link href={`/hubs/${hub.id}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
