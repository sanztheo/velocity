import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { v4 as uuidv4 } from "uuid";
import { Connection, ConnectionConfig, DatabaseType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { useConnections } from "@/hooks/useConnections";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dbType: z.enum(["SQLite", "PostgreSQL", "MySQL", "MariaDB", "SQLServer"]),
  host: z.string().optional(),
  port: z.string().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  path: z.string().optional(),
  ssl: z.boolean().default(false),
  favorite: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface ConnectionFormProps {
  connection?: Connection;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ConnectionForm({ connection, onSuccess, onCancel }: ConnectionFormProps) {
  const { save } = useConnections();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      dbType: "PostgreSQL",
      host: "localhost",
      port: "5432",
      database: "",
      username: "",
      password: "",
      path: "",
      ssl: false,
      favorite: false,
    },
  });

  // Reset form when connection prop changes
  useEffect(() => {
    if (connection) {
      form.reset({
        name: connection.name,
        dbType: connection.dbType as any,
        host: connection.config.host || "localhost",
        port: connection.config.port?.toString() || "5432",
        database: connection.config.database || "",
        username: connection.config.username || "",
        password: connection.config.password || "",
        path: connection.config.path || "",
        ssl: connection.config.ssl?.enabled || false,
        favorite: connection.favorite,
      });
    } else {
      form.reset({
        name: "",
        dbType: "PostgreSQL",
        host: "localhost",
        port: "5432",
        database: "",
        username: "",
        password: "",
        path: "",
        ssl: false,
        favorite: false,
      });
    }
  }, [connection, form]);

  const dbType = form.watch("dbType");

  async function onSubmit(data: any) {
    const values = data as FormValues;
    setIsSubmitting(true);
    try {
      const config: ConnectionConfig = {
        type: values.dbType as DatabaseType,
      };

      if (values.dbType === "SQLite") {
        config.path = values.path;
      } else {
        config.host = values.host;
        config.port = parseInt(values.port || "5432", 10);
        config.database = values.database;
        config.username = values.username;
        config.password = values.password || undefined;
        config.ssl = {
          enabled: values.ssl,
          mode: values.ssl ? "Require" : "Disable",
        };
      }

      const newConnection: Connection = {
        id: connection?.id || uuidv4(),
        name: values.name,
        dbType: values.dbType as DatabaseType,
        config,
        favorite: values.favorite,
        createdAt: connection?.createdAt || new Date().toISOString(),
        lastUsedAt: connection?.lastUsedAt,
      };

      await save.mutateAsync(newConnection);
      onSuccess();
    } catch (error) {
      console.error("Failed to save connection", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control as any}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Connection Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Production DB" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control as any}
            name="dbType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Database Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="PostgreSQL">PostgreSQL</SelectItem>
                    <SelectItem value="MySQL">MySQL</SelectItem>
                    <SelectItem value="SQLite">SQLite</SelectItem>
                    <SelectItem value="MariaDB">MariaDB</SelectItem>
                    <SelectItem value="SQLServer">SQL Server</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {dbType === "SQLite" ? (
          <FormField
            control={form.control as any}
            name="path"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Database Path</FormLabel>
                <FormControl>
                  <Input placeholder="/path/to/database.db" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control as any}
                name="host"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input placeholder="localhost" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input placeholder="5432" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control as any}
              name="database"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Name</FormLabel>
                  <FormControl>
                    <Input placeholder="my_db" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control as any}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="postgres" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control as any}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="•••••••" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
             <FormField
              control={form.control as any}
              name="ssl"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={!!field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Enable SSL
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </>
        )}
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || save.isPending}>
            {save.isPending ? "Saving..." : "Save Connection"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
