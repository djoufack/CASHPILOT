import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';

export default function SignaturePad({ onSave, onClear }) {
  const sigRef = useRef(null);

  const handleSave = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    const dataUrl = sigRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleClear = () => {
    sigRef.current?.clear();
    onClear?.();
  };

  return (
    <div className="space-y-3">
      <div className="border border-white/20 rounded-lg overflow-hidden bg-white">
        <SignatureCanvas
          ref={sigRef}
          canvasProps={{ width: 600, height: 200, className: 'w-full' }}
          penColor="#1a1a2e"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleClear} type="button">
          Effacer
        </Button>
        <Button size="sm" onClick={handleSave} type="button">
          Valider la signature
        </Button>
      </div>
    </div>
  );
}
