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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConnections } from "@/hooks/useConnections";
import { testConnection } from "@/lib/tauri";
import { Link2, Settings2, Zap, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dbType: z.enum(["SQLite", "PostgreSQL", "MySQL", "MariaDB", "CockroachDB", "Redshift", "SQLServer", "Redis"]),
  host: z.string().optional(),
  port: z.string().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  ssl: z.boolean().default(false),
  favorite: z.boolean().default(false),
  // SQL Server specific
  encrypt: z.boolean().default(false),
  trustServerCertificate: z.boolean().default(true),
  // Redis specific
  useTls: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface ConnectionFormProps {
  connection?: Connection;
  onSuccess: () => void;
  onCancel: () => void;
}

// Parse connection URL into components
function parseConnectionUrl(url: string): Partial<FormValues> | null {
  try {
    // Handle different URL formats
    // postgresql://user:password@host:port/database
    // mysql://user:password@host:port/database
    // Supports:
    // protocol://user:password@host:port/database
    // protocol://user@host:port/database
    const match = url.match(/^(\w+):\/\/(?:([^:@]+)(?::([^@]*))?@)?([^:\/]+)(?::(\d+))?\/(.+)$/);
    if (match) {
      const [, protocol, user, pass, host, port, database] = match;
      const dbTypeMap: Record<string, DatabaseType> = {
        postgresql: "PostgreSQL",
        postgres: "PostgreSQL",
        mysql: "MySQL",
        mariadb: "MariaDB",
        sqlite: "SQLite",
        cockroachdb: "CockroachDB",
        redshift: "Redshift",
        redis: "Redis",
        rediss: "Redis",
      };
      return {
        dbType: dbTypeMap[protocol.toLowerCase()] || "PostgreSQL",
        username: user || "",
        password: pass || "",
        host: host || "localhost",
        port: port || "5432",
        database: database || "",
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function ConnectionForm({ connection, onSuccess, onCancel }: ConnectionFormProps) {
  const { save } = useConnections();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [inputMode, setInputMode] = useState<"manual" | "url">("manual");

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
      url: "",
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
        url: "",
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
        url: "",
        ssl: false,
        favorite: false,
      });
    }
  }, [connection, form]);

  const dbType = form.watch("dbType");
  const urlValue = form.watch("url");

  // Parse URL when it changes
  useEffect(() => {
    if (inputMode === "url" && urlValue) {
      const parsed = parseConnectionUrl(urlValue);
      if (parsed) {
        Object.entries(parsed).forEach(([key, value]) => {
          if (value !== undefined) {
            form.setValue(key as any, value);
          }
        });
        // Auto-set name from database if empty
        if (!form.getValues("name") && parsed.database) {
          form.setValue("name", parsed.database);
        }
      }
    }
  }, [urlValue, inputMode, form]);

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
        config.password = values.password?.trim() || undefined;
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
        {/* Connection Name - Always visible */}
        <FormField
          control={form.control as any}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Connection Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="My Production DB" 
                  {...field} 
                  value={field.value || ''} 
                  className="bg-secondary border-border"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Input Mode Tabs */}
        <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "manual" | "url")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 mt-4">
            <FormField
              control={form.control as any}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection URL</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="postgresql://user:password@localhost:5432/database"
                      {...field}
                      value={field.value || ''}
                      className="bg-secondary border-border font-mono text-sm"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste your database connection URL and we'll parse it automatically
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            {/* Database Type */}
            <FormField
              control={form.control as any}
              name="dbType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PostgreSQL">PostgreSQL</SelectItem>
                      <SelectItem value="MySQL">MySQL</SelectItem>
                      <SelectItem value="MariaDB">MariaDB</SelectItem>
                      <SelectItem value="SQLite">SQLite</SelectItem>
                      <SelectItem value="CockroachDB">CockroachDB</SelectItem>
                      <SelectItem value="Redshift">Redshift</SelectItem>
                      <SelectItem value="SQLServer">SQL Server</SelectItem>
                      <SelectItem value="Redis">Redis</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {dbType === "SQLite" ? (
              <FormField
                control={form.control as any}
                name="path"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Database Path</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="/path/to/database.db" 
                        {...field} 
                        value={field.value || ''} 
                        className="bg-secondary border-border"
                      />
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
                          <Input 
                            placeholder="localhost" 
                            {...field} 
                            value={field.value || ''} 
                            className="bg-secondary border-border"
                          />
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
                          <Input 
                            placeholder="5432" 
                            {...field} 
                            value={field.value || ''} 
                            className="bg-secondary border-border"
                          />
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
                        <Input 
                          placeholder="my_db" 
                          {...field} 
                          value={field.value || ''} 
                          className="bg-secondary border-border"
                        />
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
                          <Input 
                            placeholder="postgres" 
                            {...field} 
                            value={field.value || ''} 
                            className="bg-secondary border-border"
                          />
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
                          <Input 
                            type="password" 
                            placeholder="(optional)" 
                            {...field} 
                            value={field.value || ''} 
                            className="bg-secondary border-border"
                          />
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
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-4 bg-secondary/50">
                      <FormControl>
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Enable SSL</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="pt-4 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              setIsTesting(true);
              setTestResult(null);
              try {
                const values = form.getValues();
                const config: ConnectionConfig = { type: values.dbType as DatabaseType };
                
                if (values.dbType === "SQLite") {
                  config.path = values.path;
                } else {
                  config.host = values.host;
                  config.port = parseInt(values.port || "5432", 10);
                  config.database = values.database;
                  config.username = values.username;
                  config.password = values.password?.trim() || undefined;
                  config.ssl = { enabled: values.ssl, mode: values.ssl ? "Require" : "Disable" };
                }
                
                const testConn: Connection = {
                  id: "test",
                  name: values.name || "Test",
                  dbType: values.dbType as DatabaseType,
                  config,
                  favorite: false,
                  createdAt: new Date().toISOString(),
                };
                
                await testConnection(testConn);
                setTestResult("success");
                toast.success("Connection successful!");
              } catch (error) {
                setTestResult("error");
                toast.error(`Connection failed: ${error}`);
              } finally {
                setIsTesting(false);
              }
            }}
            disabled={isTesting}
            className="flex items-center gap-2"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : testResult === "success" ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : testResult === "error" ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Test Connection
          </Button>
          
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || save.isPending}>
              {save.isPending ? "Saving..." : "Save Connection"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </Form>
  );
}
