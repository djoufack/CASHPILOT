
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useProfileSettings = () => {
  const { user, updateProfile: updateContextProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  
  // Debug state exposed to component
  const [debugLogs, setDebugLogs] = useState([]);
  
  const { toast } = useToast();

  const addLog = (message, type = 'info', data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type, data };
    const color = type === 'error' ? 'color: red' : type === 'success' ? 'color: green' : 'color: blue';
    console.log(`%c[useProfileSettings] ${message}`, color, data || '');
    setDebugLogs(prev => [logEntry, ...prev].slice(0, 50)); 
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    addLog("Fetching profile data...");
    try {
      setLoading(true);
      
      if (!supabase) throw new Error("Supabase client not initialized");

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        addLog("Error fetching profile", 'error', error);
        throw error;
      }
      
      addLog("Profile data loaded", 'success', data);
      setProfile(data);
    } catch (err) {
      addLog("Fetch exception", 'error', err);
      setError(err.message);
      toast({
        title: "Profile Load Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const validateFile = (file) => {
    addLog("Validating file...", "info", { name: file.name, size: file.size, type: file.type });
    
    if (!file) return { valid: false, error: "No file provided" };
    
    // Size check (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max 5MB.`;
      addLog("File validation failed: Size", "error", errorMsg);
      return { valid: false, error: errorMsg };
    }

    // Allowed MIME types
    const allowedTypes = [
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'image/webp', 
      'image/svg+xml'
    ];

    // Allowed Extensions (for double checking)
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    
    const fileExt = file.name.split('.').pop().toLowerCase();

    // Type check
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = `Invalid MIME type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP, SVG.`;
      addLog("File validation failed: MIME Type", "error", errorMsg);
      return { valid: false, error: errorMsg };
    }

    // Extension check to match MIME (basic safety)
    if (!allowedExtensions.includes(fileExt)) {
       const errorMsg = `Invalid file extension: .${fileExt}. Allowed: .jpg, .jpeg, .png, .gif, .webp, .svg`;
       addLog("File validation failed: Extension", "error", errorMsg);
       return { valid: false, error: errorMsg };
    }
    
    addLog("File validated successfully", "success", { type: file.type, ext: fileExt });
    return { valid: true };
  };

  const uploadFile = async (bucket, file, prefix = 'file') => {
    addLog(`Starting upload to bucket: '${bucket}'`, 'info', { fileName: file?.name, size: file?.size, type: file?.type });
    
    try {
      if (!file) throw new Error("No file provided");
      if (!supabase) throw new Error("Supabase client not ready");

      // Validate again to be safe
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Use user_id folder structure: user_id/{prefix}-{timestamp}.{extension}
      const fileExt = file.name.split('.').pop();
      const fileName = `${prefix}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      addLog(`Prepared file path: ${filePath}`);
      addLog("Attempting upload to Supabase Storage...");

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) {
        addLog("Upload failed", 'error', uploadError);
        throw uploadError;
      }

      addLog("File uploaded to storage", 'success', data);

      // Get Public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (!urlData || !urlData.publicUrl) {
        throw new Error("Failed to generate public URL");
      }

      addLog(`Public URL generated: ${urlData.publicUrl}`, 'success');
      return urlData.publicUrl;

    } catch (err) {
      addLog(`Upload process failed for ${bucket}`, 'error', err);
      throw err;
    }
  };

  // Immediate upload handler for Avatar
  const updateAvatar = async (file) => {
    if (!file) return;

    addLog("Initiating avatar update flow...", "info");
    setUploading(true);
    
    try {
      // 1. Upload to Storage
      const publicUrl = await uploadFile('avatars', file, 'avatar');
      
      if (!publicUrl) throw new Error("Could not get public URL for avatar");

      // 2. Update Profile in DB
      addLog("Updating profile avatar_url in database...", "info", { avatar_url: publicUrl });
      
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      addLog("Database updated successfully", "success");

      // 3. Update Local State
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      
      // 4. Update Context
      if (updateContextProfile) {
        await updateContextProfile({ avatar_url: publicUrl });
      }

      toast({
        title: "Succès",
        description: "Avatar uploaded successfully ✅",
        className: "bg-green-600 border-none text-white"
      });

      return publicUrl;

    } catch (err) {
      console.error("Avatar update error:", err);
      addLog("Avatar update failed", "error", err);
      
      let message = err.message || "Erreur lors de l'upload, réessayez";
      if (message.includes("fetch") || message.includes("network")) {
        message = "Vérifiez votre connexion Internet";
      }

      toast({
        title: "Erreur Upload",
        description: message,
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteAvatar = async () => {
    addLog("Deleting avatar...", "info");
    setUploading(true);
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      setProfile(prev => ({ ...prev, avatar_url: null }));
      
      if (updateContextProfile) {
        await updateContextProfile({ avatar_url: null });
      }

      toast({
        title: "Removed",
        description: "Avatar removed successfully.",
      });
      addLog("Avatar removed", "success");

    } catch (err) {
      addLog("Error removing avatar", "error", err);
      toast({
        title: "Error",
        description: "Failed to remove avatar.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };
  
  const deleteSignature = async () => {
    addLog("Deleting signature...", "info");
    setSaving(true);
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ 
          signature_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      setProfile(prev => ({ ...prev, signature_url: null }));
      
      toast({
        title: "Removed",
        description: "Signature removed successfully.",
      });
      addLog("Signature removed", "success");

    } catch (err) {
      addLog("Error removing signature", "error", err);
      toast({
        title: "Error",
        description: "Failed to remove signature.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (formData, signatureFile) => {
    addLog("Saving profile data...", 'info', formData);
    try {
      setSaving(true);
      setError(null);

      if (!supabase) throw new Error("Supabase client missing");

      // Exclude email from updates as it's not in the profiles table
      // The form data already excludes email, but this is a double check.
      const cleanedFormData = { ...formData };
      delete cleanedFormData.email; // Ensure email is never sent to profiles table
      
      let updates = { 
        ...cleanedFormData, 
        updated_at: new Date().toISOString() 
      };
      
      // Handle signature separately if provided
      if (signatureFile) {
        addLog("Processing signature file...");
        try {
          // Double check validation before upload call
          const validation = validateFile(signatureFile);
          if (!validation.valid) throw new Error(validation.error);

          const signatureUrl = await uploadFile('signatures', signatureFile, 'signature');
          if (signatureUrl) updates.signature_url = signatureUrl;
        } catch (sigErr) {
          addLog("Signature upload failed", "warn", sigErr);
          toast({
             title: "Signature Warning",
             description: `Signature failed: ${sigErr.message}`,
             variant: "warning"
          });
        }
      }

      addLog("Updating database record (excluding email)...", 'info', updates);

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (updateError) {
        addLog("Database update failed", 'error', updateError);
        throw updateError;
      }

      addLog("Profile updated successfully in DB", 'success');

      // Update Local State & Context
      // We merge with existing profile to keep email if it was there (though we don't save it)
      const newProfile = { ...profile, ...updates };
      setProfile(newProfile);
      
      try {
        await updateContextProfile(updates);
      } catch (ctxErr) {
        addLog("Auth context update warning", 'warn', ctxErr);
      }

      toast({
        title: "Success",
        description: "Profile updated successfully.",
        className: "bg-green-600 border-none text-white"
      });
      
      return true;
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err.message);
      addLog("Save operation failed", 'error', err.message);
      
      toast({
        title: "Save Failed",
        description: err.message,
        variant: "destructive"
      });
      return false;
    } finally {
      setSaving(false);
    }
  };
  
  const clearLogs = () => setDebugLogs([]);

  return {
    profile,
    loading,
    saving,
    uploading,
    error,
    saveProfile,
    updateAvatar,
    deleteAvatar,
    deleteSignature,
    debugLogs,
    addLog,
    clearLogs,
    validateFile
  };
};
