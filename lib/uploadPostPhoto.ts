import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export async function pickPostPhoto(): Promise<{ base64: string; ext: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.8,
    base64: true,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset?.base64) return null;

  const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  return { base64: asset.base64, ext };
}

export async function uploadPostPhoto(userId: string, base64: string, ext: string): Promise<string> {
  const path = `${userId}/${Date.now()}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error: uploadError } = await supabase.storage
    .from('posts')
    .upload(path, bytes, { contentType });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('posts').getPublicUrl(path);
  return data.publicUrl;
}
