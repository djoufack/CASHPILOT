
import { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useToast } from '@/components/ui/use-toast';

export const useBarcodeScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState(null);
  const scannerRef = useRef(null);
  const { toast } = useToast();

  const startScanning = async (elementId) => {
    try {
      setIsScanning(true);
      const html5QrCode = new Html5Qrcode(elementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText, decodedResult) => {
          setScannedData({ text: decodedText, format: decodedResult.result.format?.formatName || 'Unknown' });
          toast({ title: 'Barcode Detected', description: decodedText });
          // Optional: Stop scanning after one success
          // html5QrCode.stop();
          // setIsScanning(false);
        },
        (errorMessage) => {
          // parse error, ignore mostly
        }
      );
    } catch (err) {
      console.error("Error starting scanner", err);
      setIsScanning(false);
      toast({ title: 'Error', description: 'Could not access camera.', variant: 'destructive' });
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [isScanning]);

  return { isScanning, startScanning, stopScanning, scannedData };
};
