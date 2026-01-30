
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
        .maybeSingle();

      if (error) {
        addLog("Error fetching profile", 'error', error);
        throw error;
      }

      if (data) {
        addLog("Profile data loaded", 'success', data);
        setProfile(data);
      } else {
        addLog("No profile found — will create on first save", 'info');
        setProfile(null);
      }
    } catch (err) {
      addLog("Fetch exception", 'error', err);
      setError(err.message);
      toast({
        title: "Erreur chargement profil",
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

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max 5MB.`;
      addLog("File validation failed: Size", "error", errorMsg);
      return { valid: false, error: errorMsg };
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const fileExt = file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(file.type)) {
      const errorMsg = `Invalid MIME type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP, SVG.`;
      addLog("File validation failed: MIME Type", "error", errorMsg);
      return { valid: false, error: errorMsg };
    }

    if (!allowedExtensions.includes(fileExt)) {
       const errorMsg = `Invalid file extension: .${fileExt}.`;
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

      const validation = validateFile(file);
      if (!validation.valid) throw new Error(validation.error);

      const fileExt = file.name.split('.').pop();
      const fileName = `${prefix}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      addLog(`Prepared file path: ${filePath}`);

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        addLog("Upload failed", 'error', uploadError);
        throw uploadError;
      }

      addLog("File uploaded to storage", 'success', data);

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

  const updateAvatar = async (file) => {
    if (!file) return;
    addLog("Initiating avatar update flow...", "info");
    setUploading(true);

    try {
      const publicUrl = await uploadFile('avatars', file, 'avatar');
      if (!publicUrl) throw new Error("Could not get public URL for avatar");

      addLog("Updating profile avatar_url in database...", "info", { avatar_url: publicUrl });

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      addLog("Database updated successfully", "success");
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));

      if (updateContextProfile) {
        try { await updateContextProfile({ avatar_url: publicUrl }); } catch (e) { /* ignore */ }
      }

      toast({
        title: "Succès",
        description: "Avatar mis à jour avec succès",
        className: "bg-green-600 border-none text-white"
      });

      return publicUrl;
    } catch (err) {
      console.error("Avatar update error:", err);
      addLog("Avatar update failed", "error", err);
      toast({
        title: "Erreur Upload",
        description: err.message || "Erreur lors de l'upload",
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
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      setProfile(prev => ({ ...prev, avatar_url: null }));
      if (updateContextProfile) {
        try { await updateContextProfile({ avatar_url: null }); } catch (e) { /* ignore */ }
      }

      toast({ title: "Supprimé", description: "Avatar supprimé." });
      addLog("Avatar removed", "success");
    } catch (err) {
      addLog("Error removing avatar", "error", err);
      toast({ title: "Erreur", description: "Impossible de supprimer l'avatar.", variant: "destructive" });
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
        .update({ signature_url: null, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      setProfile(prev => ({ ...prev, signature_url: null }));
      toast({ title: "Supprimé", description: "Signature supprimée." });
      addLog("Signature removed", "success");
    } catch (err) {
      addLog("Error removing signature", "error", err);
      toast({ title: "Erreur", description: "Impossible de supprimer la signature.", variant: "destructive" });
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

      // Only send fields that exist in the profiles table
      const profileFields = {
        full_name: formData.full_name || '',
        phone: formData.phone || '',
        address: formData.address || '',
        city: formData.city || '',
        postal_code: formData.postal_code || '',
        country: formData.country || '',
        currency: formData.currency || 'EUR',
        timezone: formData.timezone || 'CET',
        updated_at: new Date().toISOString()
      };

      // Handle signature separately if provided
      if (signatureFile) {
        addLog("Processing signature file...");
        try {
          const validation = validateFile(signatureFile);
          if (!validation.valid) throw new Error(validation.error);

          const signatureUrl = await uploadFile('signatures', signatureFile, 'signature');
          if (signatureUrl) profileFields.signature_url = signatureUrl;
        } catch (sigErr) {
          addLog("Signature upload failed", "warn", sigErr);
          toast({
             title: "Avertissement",
             description: `Signature: ${sigErr.message}`,
             variant: "destructive"
          });
        }
      }

      addLog("Updating database record...", 'info', profileFields);

      let result;

      if (profile?.id) {
        // Update existing profile
        result = await supabase
          .from('profiles')
          .update(profileFields)
          .eq('user_id', user.id)
          .select()
          .single();
      } else {
        // Insert new profile if none exists
        result = await supabase
          .from('profiles')
          .insert([{ ...profileFields, user_id: user.id, role: 'user' }])
          .select()
          .single();
      }

      if (result.error) {
        addLog("Database operation failed", 'error', result.error);
        throw result.error;
      }

      addLog("Profile saved successfully in DB", 'success', result.data);

      // Update local state with what was actually saved in DB
      setProfile(result.data);

      try {
        if (updateContextProfile) await updateContextProfile(profileFields);
      } catch (ctxErr) {
        addLog("Auth context update warning (non-blocking)", 'warn', ctxErr);
      }

      toast({
        title: "Succès",
        description: "Profil mis à jour avec succès.",
        className: "bg-green-600 border-none text-white"
      });

      return true;
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err.message);
      addLog("Save operation failed", 'error', err.message);

      toast({
        title: "Erreur de sauvegarde",
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
