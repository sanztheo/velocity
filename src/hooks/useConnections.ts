import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Connection } from "@/types";
import { loadConnections, saveConnection, deleteConnection } from "@/lib/tauri";
import { useAppStore } from "@/stores/app.store";
import { toast } from "sonner";

export function useConnections() {
  const queryClient = useQueryClient();
  const { setConnections, addConnection, updateConnection, removeConnection } = useAppStore();

  const query = useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const data = await loadConnections();
      setConnections(data); // Sync with store
      return data;
    },
    staleTime: Infinity, // Connections don't change often from outside
  });

  const saveMutation = useMutation({
    mutationFn: saveConnection,
    onSuccess: (savedConn) => {
      queryClient.setQueryData(["connections"], (old: Connection[] | undefined) => {
        if (!old) return [savedConn];
        const exists = old.find((c) => c.id === savedConn.id);
        return exists 
          ? old.map((c) => c.id === savedConn.id ? savedConn : c)
          : [...old, savedConn];
      });
      
      // Update store optimistically/confirmed
      const isNew = !query.data?.some(c => c.id === savedConn.id);
      if (isNew) {
        addConnection(savedConn);
      } else {
        updateConnection(savedConn);
      }
      
      toast.success("Connection saved successfully");
    },
    onError: (error) => {
      toast.error(`Failed to save connection: ${error}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteConnection,
    onSuccess: (_, id) => {
      queryClient.setQueryData(["connections"], (old: Connection[] | undefined) => 
        old ? old.filter((c) => c.id !== id) : []
      );
      removeConnection(id);
      toast.success("Connection deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete connection: ${error}`);
    }
  });

  return {
    ...query,
    save: saveMutation,
    delete: deleteMutation,
  };
}
