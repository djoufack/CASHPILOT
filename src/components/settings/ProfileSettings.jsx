
import React, { useState, useEffect, useRef } from 'react';
import { useProfileSettings } from '@/hooks/useProfileSettings';
import { useAuth } from '@/context/AuthContext';
import { checkSupabaseConnection } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { COUNTRIES } from '@/constants/countries';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Upload, Trash2, PenTool, Bug, RefreshCw, CheckCircle2, XCircle, Camera, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ProfileSettings = () => {
  const { user } = useAuth(); // Access user for read-only email
  const { 
    profile, loading, saving, uploading, 
    saveProfile, updateAvatar, deleteAvatar, deleteSignature,
    debugLogs, addLog, clearLogs 
  } = useProfileSettings();
  
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    // email removed from state to prevent accidental submission
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    country: '',
    currency: 'USD',
    timezone: 'UTC'
  });

  // State for file previews/selections
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  
  // Debug State
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        city: profile.city || '',
        postal_code: profile.postal_code || '',
        country: profile.country || '',
        currency: profile.currency || 'USD',
        timezone: profile.timezone || 'UTC'
      });
      if (profile.signature_url && !signatureFile) {
        setSignaturePreview(profile.signature_url);
      }
      addLog("Form populated from profile data");
    }
  }, [profile, signatureFile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateFile = (file) => {
    addLog("Validating file...", "info", { name: file.name, size: file.size, type: file.type });
    
    if (!file) return false;
    
    // Size check (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB`;
      addLog("File validation failed: Size", "error", errorMsg);
      toast({
        title: "Erreur",
        description: "Fichier trop volumineux (max 5MB)",
        variant: "destructive"
      });
      return false;
    }

    // Type check
    const validTypes = ['image/jpeg', 'image/png', 'image/gif']; // Updated to allow jpeg, png, gif
    if (!validTypes.includes(file.type)) {
      const errorMsg = `Invalid file type: ${file.type}. Accepted formats are JPG, PNG, GIF.`; // Clearer error message
      addLog("File validation failed: Type", "error", errorMsg);
      toast({
        title: "Erreur",
        description: errorMsg,
        variant: "destructive"
      });
      return false;
    }
    
    addLog("File validated successfully", "success");
    return true;
  };

  // Immediate upload handler for Avatar
  const handleAvatarFileChange = async (e) => {
    addLog("Avatar file selection triggered");
    
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (!validateFile(file)) {
        addLog("Validation failed, resetting input");
        e.target.value = null; 
        return;
      }

      // Proceed to upload immediately
      await updateAvatar(file);
      
      // Reset input so same file can be selected again if needed
      e.target.value = null;
    }
  };

  // Signature is handled on save
  const handleSignatureChange = (e) => {
     if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSignatureFile(file);
        setSignaturePreview(URL.createObjectURL(file));
      } else {
        e.target.value = null;
      }
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    addLog("Form submitted by user - starting saveProfile");
    const success = await saveProfile(formData, signatureFile);
    if(success) {
      setSignatureFile(null); // Clear pending file after successful save
    }
  };
  
  const handleRemoveSignature = async () => {
    if (signatureFile) {
      // If there's a pending file but not saved yet
      setSignatureFile(null);
      setSignaturePreview(profile?.signature_url || null);
    } else if (profile?.signature_url) {
      // If deleting from server
      if(window.confirm("Are you sure you want to remove your signature?")) {
        await deleteSignature();
        setSignaturePreview(null);
      }
    }
  };

  const runConnectionTest = async () => {
    setIsTestingConnection(true);
    addLog("Starting connection test...");
    try {
      const result = await checkSupabaseConnection();
      setConnectionStatus(result);
      addLog("Connection test finished", result.connected ? "success" : "error", result);
      
      if (result.connected) {
        toast({ title: "Connection OK", description: `Supabase reachable`, variant: "default" });
      } else {
        toast({ title: "Connection Failed", description: result.error, variant: "destructive" });
      }
    } catch (err) {
      addLog("Connection test exception", "error", err);
    } finally {
      setIsTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex flex-col justify-center items-center h-full gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-orange-400" />
        <p className="text-gray-400">Loading profile configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <Card className="bg-gray-900 border-gray-800 text-white shadow-xl">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription className="text-gray-400">Manage your public profile and contact details.</CardDescription>
              </div>
              <Badge variant={uploading ? "secondary" : "outline"} className={uploading ? "animate-pulse bg-orange-900/50 text-orange-200" : ""}>
                 {uploading ? (
                   <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Uploading Avatar...</span>
                 ) : saving ? (
                   <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>
                 ) : "Ready"}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-8">
            {/* Avatar Section */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 border-b border-gray-800 pb-8">
              <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-gray-800 shadow-lg cursor-pointer transition-all duration-300 group-hover:border-orange-500/50" onClick={triggerFileInput}>
                  <AvatarImage src={profile?.avatar_url} className={`object-cover ${uploading ? 'opacity-50' : ''}`} />
                  <AvatarFallback className="bg-gradient-to-br from-yellow-500 to-lime-500 text-4xl font-bold">
                    {formData.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                {/* Upload Overlay */}
                {uploading ? (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center z-20">
                    <Loader2 className="w-8 h-8 animate-spin text-white mb-1" />
                  </div>
                ) : (
                  <div 
                    className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={triggerFileInput}
                  >
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gradient mb-1">Profile Picture</h3>
                  <p className="text-sm text-gray-400">Upload a professional photo. JPG, PNG or GIF. Max size 5MB.</p> {/* Updated description */}
                </div>
                <div className="flex gap-4">
                   <Button 
                    type="button"
                    onClick={triggerFileInput}
                    disabled={uploading}
                    className="bg-orange-500 hover:bg-orange-600 text-white min-w-[140px]"
                   >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Avatar
                        </>
                      )}
                   </Button>
                   
                   {profile?.avatar_url && (
                    <Button 
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        if(window.confirm("Remove avatar?")) deleteAvatar();
                      }}
                      disabled={uploading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                   )}
                   
                   {/* Hidden File Input */}
                  <Input 
                    ref={fileInputRef}
                    id="avatar-upload" 
                    type="file" 
                    accept="image/jpeg, image/png, image/gif" // Updated accept attribute
                    className="hidden" 
                    onChange={handleAvatarFileChange} 
                    disabled={uploading}
                  />
                </div>
              </div>
            </div>

            {/* Form Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name <span className="text-red-500">*</span></Label>
                <Input 
                  id="full_name" 
                  name="full_name" 
                  value={formData.full_name} 
                  onChange={handleChange} 
                  className="bg-gray-800 border-gray-700 text-white focus:ring-orange-500" 
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  Email 
                  <Lock className="w-3 h-3 text-gray-500" />
                </Label>
                <div className="relative">
                  <Input 
                    id="email" 
                    name="email" 
                    type="email"
                    value={user?.email || ''} 
                    className="bg-gray-800/50 border-gray-700 text-gray-400 cursor-not-allowed pr-10" 
                    disabled 
                    readOnly
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <span className="text-xs text-gray-500">Read-only</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Email is managed via your account settings and cannot be changed here.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  className="bg-gray-800 border-gray-700 text-white focus:ring-orange-500" 
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input 
                  id="address" 
                  name="address" 
                  value={formData.address} 
                  onChange={handleChange} 
                  className="bg-gray-800 border-gray-700 text-white focus:ring-orange-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city" 
                    name="city" 
                    value={formData.city} 
                    onChange={handleChange} 
                    className="bg-gray-800 border-gray-700 text-white focus:ring-orange-500" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input 
                    id="postal_code" 
                    name="postal_code" 
                    value={formData.postal_code} 
                    onChange={handleChange} 
                    className="bg-gray-800 border-gray-700 text-white focus:ring-orange-500" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select value={formData.country} onValueChange={(val) => handleSelectChange('country', val)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select Country" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-[300px]">
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select value={formData.currency} onValueChange={(val) => handleSelectChange('currency', val)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select Currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={formData.timezone} onValueChange={(val) => handleSelectChange('timezone', val)}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Select Timezone" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="EST">Eastern Time (US)</SelectItem>
                    <SelectItem value="PST">Pacific Time (US)</SelectItem>
                    <SelectItem value="CET">Central European Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Digital Signature */}
            <div className="border-t border-gray-800 pt-8 mt-8">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                <PenTool className="w-5 h-5 mr-2 text-orange-400" />
                Digital Signature
              </h3>
              <div className="bg-gray-950 p-6 rounded-lg border border-gray-800 dashed border-2 border-dashed border-gray-700 flex flex-col items-center justify-center min-h-[150px]">
                {signaturePreview ? (
                   <div className="relative group">
                     <img src={signaturePreview} alt="Signature" loading="lazy" className="max-h-32 object-contain bg-white/5 p-2 rounded" />
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded">
                        <Label htmlFor="sig-upload" className="cursor-pointer">
                          <div className="p-2 bg-orange-500 hover:bg-orange-600 rounded-full text-white" title="Change">
                             <Upload size={16} />
                          </div>
                        </Label>
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="icon" 
                          className="h-8 w-8 rounded-full"
                          onClick={handleRemoveSignature}
                          title="Remove"
                        >
                           <Trash2 size={14} />
                        </Button>
                     </div>
                   </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-500 mb-4">No signature uploaded</p>
                    <Label htmlFor="sig-upload" className="cursor-pointer">
                      <div className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 text-sm">
                        Upload Image
                      </div>
                    </Label>
                  </div>
                )}
                <Input 
                    id="sig-upload" 
                    type="file" 
                    accept="image/jpeg, image/png, image/gif" // Updated accept attribute
                    className="hidden" 
                    onChange={handleSignatureChange} 
                  />
              </div>
              <p className="text-xs text-gray-500 mt-2">Upload a scan of your signature (transparent PNG recommended) to be used on invoices and quotes. Accepted formats are JPG, PNG, GIF. </p> {/* Updated description */}
            </div>
          </CardContent>

          <CardFooter className="flex justify-end pt-6 border-t border-gray-800 bg-gray-900/50">
            <Button 
              type="submit" 
              disabled={saving || uploading} 
              className="bg-orange-500 hover:bg-orange-600 text-white min-w-[150px] shadow-lg shadow-orange-900/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {/* Debug Panel - Only visible in development */}
      {import.meta.env.DEV && (
      <Accordion type="single" collapsible className="w-full bg-gray-900 border border-gray-800 rounded-lg">
        <AccordionItem value="debug-panel" className="border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-800/50 rounded-t-lg">
            <div className="flex items-center gap-2 text-gray-400">
              <Bug size={16} />
              <span className="font-mono text-sm">Supabase Debug Panel</span>
              {connectionStatus && (
                <Badge variant={connectionStatus.connected ? "success" : "destructive"} className="ml-2 h-5 text-xs">
                  {connectionStatus.connected ? "Online" : "Offline"}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-0 pb-0">
             <div className="p-4 bg-black/50 space-y-4">
                {/* Controls */}
                <div className="flex flex-wrap gap-2 pb-4 border-b border-gray-800">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={runConnectionTest} 
                    disabled={isTestingConnection}
                    className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
                  >
                    {isTestingConnection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Test Connection
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearLogs}
                    className="border-gray-700 bg-gray-800 text-white hover:bg-gray-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Logs
                  </Button>
                </div>

                {/* Connection Status Detail */}
                {connectionStatus && (
                  <div className={`p-3 rounded text-sm ${connectionStatus.connected ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'}`}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {connectionStatus.connected ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      {connectionStatus.connected ? "Connected" : "Disconnected"}
                    </div>
                    {connectionStatus.details && (
                      <pre className="text-xs opacity-70 mt-1 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(connectionStatus.details, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Live Logs */}
                <div className="space-y-1">
                   <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-wider font-semibold">
                      <span>Live Logs</span>
                      <span>{debugLogs.length} events</span>
                   </div>
                   <ScrollArea className="h-[200px] w-full rounded border border-gray-800 bg-gray-950 font-mono text-xs">
                      <div className="p-2 space-y-1">
                        {debugLogs.length === 0 && (
                          <div className="text-gray-600 italic p-2 text-center">No logs yet. Perform actions to see debug info.</div>
                        )}
                        {debugLogs.map((log, i) => (
                          <div key={i} className="flex gap-2 border-b border-gray-900/50 pb-1 last:border-0 hover:bg-gray-900/50 p-1 rounded">
                             <span className="text-gray-500 whitespace-nowrap">[{log.timestamp}]</span>
                             <div className="flex-1 break-all">
                                <span className={`
                                  ${log.type === 'error' ? 'text-red-400 font-bold' : ''}
                                  ${log.type === 'warn' ? 'text-yellow-400' : ''}
                                  ${log.type === 'success' ? 'text-green-400' : ''}
                                  ${log.type === 'info' ? 'text-orange-300' : ''}
                                `}>
                                  {log.message}
                                </span>
                                {log.data && (
                                  <pre className="mt-1 text-gray-600 bg-black/30 p-1 rounded overflow-x-auto">
                                    {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}
                                  </pre>
                                )}
                             </div>
                          </div>
                        ))}
                      </div>
                   </ScrollArea>
                </div>
             </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      )}
    </div>
  );
};

export default ProfileSettings;
