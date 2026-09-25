import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

export type VaultItem = {
  id: string;
  name: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

type VaultMetadata = {
  version: 1;
  salt: string;
  checkNonce: string;
  keyCheck: string;
};

type EncryptedVault = {
  version: 1;
  nonce: string;
  ciphertext: string;
};

const METADATA_KEY = 'keeper.vault.metadata.v1';
const ENCRYPTED_DATA_KEY = 'keeper.vault.data.v1';
export const BIOMETRIC_KEY = 'keeper.vault.biometric-key.v1';
export const BIOMETRIC_ENABLED_KEY = 'keeper.vault.biometric-enabled.v1';
export const THEME_KEY = 'keeper.appearance.v1';
const PBKDF2_ITERATIONS = 210_000;
const CHECK_TEXT = 'keeper-master-key-check-v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[\da-f]*$/i.test(hex)) {
    throw new Error('The local vault data is damaged.');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function deriveVaultKey(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  return pbkdf2Async(sha256, password, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: 32,
  });
}

export async function readVaultMetadata(): Promise<VaultMetadata | null> {
  const raw = await getLocalSetting(METADATA_KEY);
  if (!raw) return null;
  try {
    const metadata = JSON.parse(raw) as VaultMetadata;
    if (
      metadata.version !== 1 ||
      !metadata.salt ||
      !metadata.checkNonce ||
      !metadata.keyCheck
    ) {
      throw new Error('Invalid metadata');
    }
    return metadata;
  } catch {
    throw new Error('Keeper could not read the local vault settings.');
  }
}

export async function createVault(
  password: string,
  items: VaultItem[],
): Promise<Uint8Array> {
  const salt = await Crypto.getRandomBytesAsync(16);
  const key = await deriveVaultKey(password, salt);
  const checkNonce = await Crypto.getRandomBytesAsync(12);
  const keyCheck = gcm(key, checkNonce).encrypt(encoder.encode(CHECK_TEXT));
  const encrypted = await encryptItems(items, key);

  await AsyncStorage.setItem(ENCRYPTED_DATA_KEY, JSON.stringify(encrypted));
  const metadata: VaultMetadata = {
    version: 1,
    salt: toHex(salt),
    checkNonce: toHex(checkNonce),
    keyCheck: toHex(keyCheck),
  };
  await setLocalSetting(METADATA_KEY, JSON.stringify(metadata));
  return key;
}

export async function unlockVault(password: string): Promise<{
  key: Uint8Array;
  items: VaultItem[];
}> {
  const metadata = await readVaultMetadata();
  if (!metadata) throw new Error('No vault has been set up yet.');
  const key = await deriveVaultKey(password, fromHex(metadata.salt));
  try {
    const check = gcm(key, fromHex(metadata.checkNonce)).decrypt(
      fromHex(metadata.keyCheck),
    );
    if (decoder.decode(check) !== CHECK_TEXT) throw new Error('Incorrect password');
  } catch {
    throw new Error('That master password did not match. Try again.');
  }

  const raw = await AsyncStorage.getItem(ENCRYPTED_DATA_KEY);
  if (!raw) return { key, items: [] };
  try {
    const vault = JSON.parse(raw) as EncryptedVault;
    if (vault.version !== 1) throw new Error('Unsupported vault');
    const plaintext = gcm(key, fromHex(vault.nonce)).decrypt(
      fromHex(vault.ciphertext),
    );
    return { key, items: JSON.parse(decoder.decode(plaintext)) as VaultItem[] };
  } catch {
    throw new Error('Keeper could not decrypt the vault. Your local data may be damaged.');
  }
}

export async function saveVaultItems(
  items: VaultItem[],
  key: Uint8Array,
): Promise<void> {
  const encrypted = await encryptItems(items, key);
  await AsyncStorage.setItem(ENCRYPTED_DATA_KEY, JSON.stringify(encrypted));
}

export async function storeBiometricKey(key: Uint8Array): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Biometric unlock is only available in the iOS and Android apps.');
  }
  await SecureStore.setItemAsync(BIOMETRIC_KEY, toHex(key), {
    requireAuthentication: true,
    authenticationPrompt: 'Unlock your Keeper vault',
  });
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
}

export async function unlockWithBiometrics(): Promise<{
  key: Uint8Array;
  items: VaultItem[];
}> {
  const keyHex = await SecureStore.getItemAsync(BIOMETRIC_KEY, {
    requireAuthentication: true,
    authenticationPrompt: 'Unlock your Keeper vault',
  });
  if (!keyHex) throw new Error('Biometric unlock is not set up on this device.');
  const key = fromHex(keyHex);
  const raw = await AsyncStorage.getItem(ENCRYPTED_DATA_KEY);
  if (!raw) return { key, items: [] };
  try {
    const vault = JSON.parse(raw) as EncryptedVault;
    if (vault.version !== 1) throw new Error('Unsupported vault');
    const plaintext = gcm(key, fromHex(vault.nonce)).decrypt(
      fromHex(vault.ciphertext),
    );
    return { key, items: JSON.parse(decoder.decode(plaintext)) as VaultItem[] };
  } catch {
    throw new Error('Keeper could not decrypt the vault. Unlock with your master password.');
  }
}

export async function disableBiometrics(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
}

export async function readBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === 'true';
}

async function encryptItems(items: VaultItem[], key: Uint8Array): Promise<EncryptedVault> {
  const nonce = await Crypto.getRandomBytesAsync(12);
  const ciphertext = gcm(key, nonce).encrypt(encoder.encode(JSON.stringify(items)));
  return { version: 1, nonce: toHex(nonce), ciphertext: toHex(ciphertext) };
}

async function getLocalSetting(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setLocalSetting(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}