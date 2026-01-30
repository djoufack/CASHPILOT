
import React from 'react';
import { useSeedData } from '@/hooks/useSeedData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, Database, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const SeedDataManager = () => {
  const { loading, progress, createTestUsers, seedDatabase } = useSeedData();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Seed Data Manager</h1>
        <p className="text-muted-foreground">
          Manage test users and populate the database with sample data for development and testing.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Test Users
            </CardTitle>
            <CardDescription>
              Create standard test accounts (Admin, SCTE SRL, Freelance).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-sm space-y-2">
                <p className="font-medium">Accounts to be created:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>admin.test@cashpilot.cloud (Role: Admin)</li>
                  <li>scte.test@cashpilot.cloud (Role: User)</li>
                  <li>freelance.test@cashpilot.cloud (Role: User)</li>
                </ul>
              </div>
              <Button 
                onClick={createTestUsers} 
                disabled={loading}
                className="w-full"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                Create Test Users
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-500" />
              Seed Database
            </CardTitle>
            <CardDescription>
              Populate tables with sample suppliers, products, orders, and logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
              <div className="rounded-md bg-muted p-4 text-sm space-y-2">
                <p className="font-medium">Data to be generated:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>Suppliers & Locations</li>
                  <li>Products & Inventory</li>
                  <li>Services & Pricing</li>
                  <li>Notifications & Audit Logs</li>
                </ul>
              </div>
              <Button 
                onClick={seedDatabase} 
                disabled={loading}
                variant="secondary"
                className="w-full"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                Seed Database
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-[400px] flex flex-col">
        <CardHeader>
          <CardTitle>Operation Log</CardTitle>
          <CardDescription>Real-time status of seed operations</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <ScrollArea className="h-full w-full rounded-md border p-4 bg-black/5">
            {progress.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p>No operations running.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {progress.map((log, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="mt-0.5">
                      {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {log.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                      {log.status === 'pending' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                      {log.status === 'info' && <div className="h-1.5 w-1.5 rounded-full bg-gray-400 mt-1.5 ml-1" />}
                    </div>
                    <div className="flex-1">
                      <p className={cn(
                        "leading-tight",
                        log.status === 'error' ? "text-red-600 font-medium" : "text-gray-700 dark:text-gray-300"
                      )}>
                        {log.message}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SeedDataManager;
