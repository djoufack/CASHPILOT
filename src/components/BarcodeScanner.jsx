
import React, { useEffect, useState } from 'react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Camera, StopCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BarcodeScanner = () => {
  const { isScanning, startScanning, stopScanning, scannedData } = useBarcodeScanner();
  const [manualCode, setManualCode] = useState('');
  const { toast } = useToast();

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode) {
      toast({ title: 'Manual Entry', description: `Processed code: ${manualCode}` });
      setManualCode('');
    }
  };

  return (
    <div className="space-y-6 text-white p-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-400" /> Scanner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-black min-h-[300px] mb-4 relative">
             {!isScanning && (
               <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                 Camera Inactive
               </div>
             )}
          </div>
          
          <div className="flex justify-center gap-4 mb-6">
            {!isScanning ? (
              <Button onClick={() => startScanning('reader')} className="bg-blue-600 hover:bg-blue-700">
                <Camera className="mr-2 h-4 w-4" /> Start Camera
              </Button>
            ) : (
              <Button onClick={stopScanning} variant="destructive">
                <StopCircle className="mr-2 h-4 w-4" /> Stop
              </Button>
            )}
          </div>

          {scannedData && (
            <div className="bg-gray-800 p-4 rounded-lg border border-green-500/50 mb-4 animate-in fade-in">
              <p className="text-green-400 font-bold">Code Detected!</p>
              <p className="text-2xl font-mono text-white break-all">{scannedData.text}</p>
              <p className="text-xs text-gray-400 mt-1">Format: {scannedData.format}</p>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-900 px-2 text-gray-500">Or enter manually</span>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
            <Input 
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter barcode number..."
              className="bg-gray-800 border-gray-700 text-white"
            />
            <Button type="submit" variant="secondary">Submit</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BarcodeScanner;
