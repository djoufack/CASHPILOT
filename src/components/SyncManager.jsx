
import React from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

const SyncManager = () => {
  const { isOnline, queueSize, processQueue } = useOfflineSync();

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
             <RefreshCw className="text-green-500" /> Sync Manager
          </span>
          <Badge variant={isOnline ? "default" : "destructive"} className="gap-1">
             {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
             {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
         <div className="flex items-center justify-between p-4 bg-gray-800 rounded border border-gray-700">
            <div>
               <p className="text-sm font-medium text-gray-300">Pending Changes</p>
               <p className="text-2xl font-bold text-white">{queueSize}</p>
            </div>
            <Button 
               onClick={() => processQueue()} 
               disabled={!isOnline || queueSize === 0}
               variant="outline"
               className="border-gray-600 text-gray-300 hover:text-white"
            >
               Force Sync
            </Button>
         </div>
         {queueSize > 0 && !isOnline && (
            <p className="text-xs text-yellow-500">
               Changes are saved locally and will sync automatically when connection is restored.
            </p>
         )}
      </CardContent>
    </Card>
  );
};

export default SyncManager;
