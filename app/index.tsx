import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Moon,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  X,
  Settings,
} from 'lucide-react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import {
  THEME_KEY,
  type VaultItem,
  createVault,
  disableBiometrics,
  readBiometricEnabled,
  readVaultMetadata,
  saveVaultItems,
  storeBiometricKey,
  unlockVault,
  unlockWithBiometrics,
} from '@/src/vault';

type Appearance = 'light' | 'dark';
type ModalMode = 'editor' | 'settings' | 'delete' | null;
type Draft = Pick<VaultItem, 'name' | 'username' | 'password' | 'url' | 'notes'> & {
  tagsText: string;
};

const seedItems: VaultItem[] = [
  {
    id: 'demo-apple',
    name: 'Apple',
    username: 'alex.morgan@example.com',
    password: 'Cedar!planet27',
    url: 'apple.com',
    notes: '',
    tags: ['#personal', '#shopping'],
    status: 'active',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'demo-notion',
    name: 'Notion',
    username: 'alex.morgan@example.com',
    password: 'PaperHarbor_84',
    url: 'notion.so',
    notes: 'Workspace account',
    tags: ['#work', '#productivity'],
    status: 'active',
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
  },
  {
    id: 'demo-spotify',
    name: 'Spotify',
    username: 'alex.music@example.com',
    password: 'SignalRiver!29',
    url: 'spotify.com',
    notes: '',
    tags: ['#entertainment', '#music'],
    status: 'active',
    createdAt: '2026-09-03T12:00:00.000Z',
    updatedAt: '2026-09-03T12:00:00.000Z',
  },
  {
    id: 'demo-instagram',
    name: 'Instagram',
    username: '@alex.makes',
    password: 'BlueHour!561',
    url: 'instagram.com',
    notes: '',
    tags: ['#socialmedia', '#personal'],
    status: 'active',
    createdAt: '2026-09-04T12:00:00.000Z',
    updatedAt: '2026-09-04T12:00:00.000Z',
  },
  {
    id: 'demo-netflix',
    name: 'Netflix',
    username: 'alex.morgan@example.com',
    password: 'CopperCloud_73',
    url: 'netflix.com',
    notes: 'Demo entry — replace with your own details',
    tags: ['#entertainment', '#streaming'],
    status: 'active',
    createdAt: '2026-09-05T12:00:00.000Z',
    updatedAt: '2026-09-05T12:00:00.000Z',
  },
  {
    id: 'demo-github',
    name: 'GitHub',
    username: 'alexmorgan',
    password: 'MapleBranch!612',
    url: 'github.com',
    notes: '',
    tags: ['#work', '#development'],
    status: 'active',
    createdAt: '2026-09-06T12:00:00.000Z',
    updatedAt: '2026-09-06T12:00:00.000Z',
  },
];

const emptyDraft: Draft = {
  name: '',
  username: '',
  password: '',
  url: '',
  notes: '',
  tagsText: '',
};

export default function KeeperHome() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [appearance, setAppearance] = useState<Appearance>('dark');
  const colors = useColors(appearance);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isTablet = width >= 740;

  const [isReady, setIsReady] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState('all');
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultItem | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [appearanceMessage, setAppearanceMessage] = useState('');

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 16);

  useEffect(() => {
    let alive = true;
    Promise.all([
      readVaultMetadata(),
      AsyncStorage.getItem(THEME_KEY),
      readBiometricEnabled(),
    ])
      .then(([metadata, savedAppearance, biometricFlag]) => {
        if (!alive) return;
        setHasVault(Boolean(metadata));
        if (savedAppearance === 'light' || savedAppearance === 'dark') {
          setAppearance(savedAppearance);
        }
        setBiometricsEnabled(biometricFlag);
        setIsReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setErrorMessage('Keeper could not open local storage. Please reload and try again.');
        setIsReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const lockVault = useCallback(() => {
    setVaultKey(null);
    setItems([]);
    setRevealedIds([]);
    setIsUnlocked(false);
    setMasterPassword('');
    setConfirmPassword('');
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && isUnlocked) lockVault();
    });
    return () => subscription.remove();
  }, [isUnlocked, lockVault]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesTag = activeTag === 'all' || item.tags.includes(activeTag);
      const searchText = [
        item.name,
        item.username,
        item.url,
        ...item.tags,
      ].join(' ').toLocaleLowerCase();
      return matchesTag && (!normalizedQuery || searchText.includes(normalizedQuery));
    });
  }, [activeTag, items, searchQuery]);

  const tags = useMemo(
    () => [...new Set(items.flatMap((item) => item.tags))].sort(),
    [items],
  );

  async function createMasterVault() {
    setErrorMessage('');
    if (masterPassword.trim().length < 10) {
      setErrorMessage('Choose a master password with at least 10 characters.');
      return;
    }
    if (masterPassword !== confirmPassword) {
      setErrorMessage('Those passwords do not match yet.');
      return;
    }
    setBusy(true);
    try {
      const key = await createVault(masterPassword, seedItems);
      setVaultKey(key);
      setItems(seedItems);
      setHasVault(true);
      setIsUnlocked(true);
      setMasterPassword('');
      setConfirmPassword('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setErrorMessage('Keeper could not create the encrypted vault. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithMasterPassword() {
    setErrorMessage('');
    if (!masterPassword) {
      setErrorMessage('Enter your master password to continue.');
      return;
    }
    setBusy(true);
    try {
      const result = await unlockVault(masterPassword);
      setVaultKey(result.key);
      setItems(result.items);
      setIsUnlocked(true);
      setMasterPassword('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Keeper could not unlock the vault.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithBiometric() {
    setErrorMessage('');
    setBusy(true);
    try {
      const result = await unlockWithBiometrics();
      setVaultKey(result.key);
      setItems(result.items);
      setIsUnlocked(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Biometric unlock did not complete. Use your master password instead.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function persistItems(nextItems: VaultItem[]) {
    if (!vaultKey) return;
    await saveVaultItems(nextItems, vaultKey);
    setItems(nextItems);
    setRevealedIds([]);
  }

  function startAdding() {
    setEditingItem(null);
    setDraft(emptyDraft);
    setFormError('');
    setModalMode('editor');
  }

  function startEditing(item: VaultItem) {
    setEditingItem(item);
    setDraft({
      name: item.name,
      username: item.username,
      password: item.password,
      url: item.url,
      notes: item.notes,
      tagsText: item.tags.join(', '),
    });
    setFormError('');
    setModalMode('editor');
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      setFormError('Add an app or website name to continue.');
      return;
    }
    if (!draft.username.trim() && !draft.password.trim()) {
      setFormError('Add a username, password, or both.');
      return;
    }
    if (!vaultKey) return;
    const now = new Date().toISOString();
    const normalizedTags = draft.tagsText
      .split(',')
      .map((tag) => tag.trim().replace(/^#+/, ''))
      .filter(Boolean)
      .map((tag) => `#${tag.toLocaleLowerCase().replace(/\s+/g, '')}`);
    const nextItem: VaultItem = {
      id: editingItem?.id ?? Crypto.randomUUID(),
      name: draft.name.trim(),
      username: draft.username.trim(),
      password: draft.password,
      url: draft.url.trim(),
      notes: draft.notes.trim(),
      tags: [...new Set(normalizedTags)],
      status: editingItem?.status ?? 'active',
      createdAt: editingItem?.createdAt ?? now,
      updatedAt: now,
    };
    setBusy(true);
    try {
      const nextItems = editingItem
        ? items.map((item) => (item.id === editingItem.id ? nextItem : item))
        : [nextItem, ...items];
      await persistItems(nextItems);
      setModalMode(null);
      setEditingItem(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setFormError('The encrypted entry could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await persistItems(items.filter((item) => item.id !== deleteTarget.id));
      setModalMode(null);
      setDeleteTarget(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setFormError('The entry could not be deleted. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleBiometrics() {
    setAppearanceMessage('');
    if (biometricsEnabled) {
      try {
        await disableBiometrics();
        setBiometricsEnabled(false);
        setAppearanceMessage('Biometric unlock is turned off.');
      } catch {
        setAppearanceMessage('Could not turn off biometric unlock. Try again.');
      }
      return;
    }
    if (Platform.OS === 'web') {
      setAppearanceMessage('Biometric unlock is available in the iOS and Android apps.');
      return;
    }
    if (!vaultKey) return;
    setBusy(true);
    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hardware || !enrolled) {
        setAppearanceMessage('Set up Face ID or a fingerprint on this device first.');
        return;
      }
      await storeBiometricKey(vaultKey);
      setBiometricsEnabled(true);
      setAppearanceMessage('Biometric unlock is ready on this device.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setAppearanceMessage('Biometric setup was cancelled or could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function changeAppearance(nextAppearance: Appearance) {
    setAppearance(nextAppearance);
    await AsyncStorage.setItem(THEME_KEY, nextAppearance);
  }

  async function generatePassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
    const random = await Crypto.getRandomBytesAsync(48);
    const generated = Array.from(random, (byte) => alphabet[byte % alphabet.length])
      .slice(0, 20)
      .join('');
    setDraft((current) => ({ ...current, password: generated }));
  }

  function toggleReveal(id: string) {
    setRevealedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
    void Haptics.selectionAsync();
  }

  function askToDelete(item: VaultItem) {
    setDeleteTarget(item);
    setFormError('');
    setModalMode('delete');
  }

  if (!isReady) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <StatusBar barStyle={appearance === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.loadingMark}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!isUnlocked) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle={appearance === 'dark' ? 'light-content' : 'dark-content'} />
        <ScrollView
          contentContainerStyle={[
            styles.lockContent,
            { paddingTop: topInset + 22, paddingBottom: bottomInset + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.lockPage}>
            <View style={styles.brandRow}>
              <Image source={require('../assets/images/icon.png')} style={styles.logo} />
              <Text style={styles.brandName}>keeper</Text>
              <View style={styles.localPill}>
                <View style={styles.localDot} />
                <Text style={styles.localLabel}>ON THIS DEVICE</Text>
              </View>
            </View>

            <View style={styles.lockHero}>
              <View style={styles.lockIconHalo}>
                <LockKeyhole size={30} color={colors.primary} strokeWidth={1.8} />
              </View>
              <Text style={styles.lockEyebrow}>{hasVault ? 'WELCOME BACK' : 'YOUR PRIVATE VAULT'}</Text>
              <Text style={styles.lockTitle}>
                {hasVault ? 'Good to see you.' : 'Your logins, safely kept.'}
              </Text>
              <Text style={styles.lockSubtitle}>
                {hasVault
                  ? 'Unlock your vault to get back to everything you use.'
                  : 'One strong master password. The rest stays encrypted on this device.'}
              </Text>
            </View>

            <View style={styles.lockPanel}>
              <Text style={styles.fieldLabel}>MASTER PASSWORD</Text>
              <View style={styles.inputWrap}>
                <KeyRound size={17} color={colors.mutedForeground} />
                <TextInput
                  value={masterPassword}
                  onChangeText={(value) => {
                    setMasterPassword(value);
                    setErrorMessage('');
                  }}
                  style={styles.textInput}
                  placeholder={hasVault ? 'Enter your master password' : 'At least 10 characters'}
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType={hasVault ? 'go' : 'next'}
                  onSubmitEditing={() => {
                    if (hasVault) void unlockWithMasterPassword();
                  }}
                  testID="master-password"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide master password' : 'Show master password'}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  hitSlop={12}
                  testID="toggle-master-password"
                >
                  {passwordVisible ? (
                    <EyeOff size={18} color={colors.mutedForeground} />
                  ) : (
                    <Eye size={18} color={colors.mutedForeground} />
                  )}
                </Pressable>
              </View>

              {!hasVault && (
                <>
                  <Text style={[styles.fieldLabel, styles.secondFieldLabel]}>CONFIRM PASSWORD</Text>
                  <View style={styles.inputWrap}>
                    <LockKeyhole size={17} color={colors.mutedForeground} />
                    <TextInput
                      value={confirmPassword}
                      onChangeText={(value) => {
                        setConfirmPassword(value);
                        setErrorMessage('');
                      }}
                      style={styles.textInput}
                      placeholder="Enter it one more time"
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry={!confirmVisible}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => void createMasterVault()}
                      testID="confirm-master-password"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={confirmVisible ? 'Hide confirmation' : 'Show confirmation'}
                      onPress={() => setConfirmVisible((visible) => !visible)}
                      hitSlop={12}
                    >
                      {confirmVisible ? (
                        <EyeOff size={18} color={colors.mutedForeground} />
                      ) : (
                        <Eye size={18} color={colors.mutedForeground} />
                      )}
                    </Pressable>
                  </View>
                </>
              )}

              {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

              <Pressable
                accessibilityRole="button"
                onPress={() => void (hasVault ? unlockWithMasterPassword() : createMasterVault())}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  busy && styles.disabledButton,
                ]}
                testID="unlock-vault"
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>
                      {hasVault ? 'Unlock my vault' : 'Create my vault'}
                    </Text>
                    <ArrowRight size={18} color={colors.primaryForeground} />
                  </>
                )}
              </Pressable>

              {hasVault && biometricsEnabled && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void unlockWithBiometric()}
                  disabled={busy}
                  style={({ pressed }) => [styles.biometricButton, pressed && styles.pressed]}
                  testID="unlock-with-biometrics"
                >
                  <Fingerprint size={19} color={colors.primary} />
                  <Text style={styles.biometricText}>Unlock with biometrics</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.securityNotes}>
              <View style={styles.securityNote}>
                <ShieldCheck size={16} color={colors.success} />
                <Text style={styles.securityNoteText}>Encrypted before it is saved</Text>
              </View>
              <View style={styles.securityNote}>
                <LockKeyhole size={16} color={colors.primary} />
                <Text style={styles.securityNoteText}>No cloud account required</Text>
              </View>
            </View>
            {!hasVault && (
              <Text style={styles.recoveryNote}>
                Keep your master password safe. It cannot be recovered if you forget it.
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={appearance === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={[
          styles.pageContent,
          { paddingTop: topInset + 18, paddingBottom: bottomInset + 26 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.page}>
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <Image source={require('../assets/images/icon.png')} style={styles.logo} />
              <Text style={styles.brandName}>keeper</Text>
            </View>
            <View style={styles.topActions}>
              <View style={styles.encryptedBadge}>
                <ShieldCheck size={14} color={colors.success} />
                <Text style={styles.encryptedBadgeText}>Encrypted</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lock vault"
                onPress={lockVault}
                style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
                testID="lock-vault"
              >
                <LockKeyhole size={19} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Vault settings"
                onPress={() => {
                  setAppearanceMessage('');
                  setModalMode('settings');
                }}
                style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
                testID="open-settings"
              >
                <Settings size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          <View style={styles.introRow}>
            <View style={styles.introCopy}>
              <Text style={styles.eyebrow}>YOUR PRIVATE SPACE</Text>
              <Text style={styles.pageTitle}>Your vault.</Text>
              <Text style={styles.pageSubtitle}>Everything you sign into, in one safe place.</Text>
            </View>
            <View style={styles.vaultCount}>
              <Text style={styles.vaultCountNumber}>{String(items.length).padStart(2, '0')}</Text>
              <Text style={styles.vaultCountCaption}>
                {items.length === 1 ? 'LOGIN' : 'LOGINS'}
              </Text>
            </View>
          </View>

          <View style={styles.searchWrap}>
            <Search size={19} color={colors.mutedForeground} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholder="Search apps, usernames, or tags"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              testID="search-vault"
            />
            {!!searchQuery && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setSearchQuery('')}
                hitSlop={10}
              >
                <X size={17} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <View style={styles.filterHeading}>
            <View style={styles.filterTitleRow}>
              <Tag size={15} color={colors.mutedForeground} />
              <Text style={styles.filterHeadingText}>FILTER BY TAG</Text>
            </View>
            <Text style={styles.resultCount}>{filteredItems.length} shown</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagRail}
          >
            <TagChip
              label="All"
              selected={activeTag === 'all'}
              onPress={() => setActiveTag('all')}
              styles={styles}
            />
            {tags.map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                selected={activeTag === tag}
                onPress={() => setActiveTag(tag)}
                styles={styles}
              />
            ))}
          </ScrollView>

          <View style={styles.listHeading}>
            <View>
              <Text style={styles.listTitle}>Saved logins</Text>
              <Text style={styles.listSubtitle}>Tap the eye to reveal account details.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={startAdding}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              testID="add-credential"
            >
              <Plus size={17} color={colors.primaryForeground} />
              <Text style={styles.addButtonText}>Add new</Text>
            </Pressable>
          </View>

          {filteredItems.length ? (
            <View style={styles.cardGrid}>
              {filteredItems.map((item) => (
                <CredentialCard
                  key={item.id}
                  item={item}
                  isRevealed={revealedIds.includes(item.id)}
                  isTablet={isTablet}
                  styles={styles}
                  colors={colors}
                  onToggleReveal={() => toggleReveal(item.id)}
                  onEdit={() => startEditing(item)}
                  onDelete={() => askToDelete(item)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Search size={22} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {items.length ? 'No matching logins' : 'Your vault is clear'}
              </Text>
              <Text style={styles.emptyDescription}>
                {items.length
                  ? 'Try a different app name or tag, or clear the filters.'
                  : 'Add a login for any app or website to get started.'}
              </Text>
              {items.length ? (
                <Pressable
                  onPress={() => {
                    setSearchQuery('');
                    setActiveTag('all');
                  }}
                  style={styles.emptyAction}
                >
                  <Text style={styles.emptyActionText}>Clear filters</Text>
                </Pressable>
              ) : (
                <Pressable onPress={startAdding} style={styles.emptyAction}>
                  <Text style={styles.emptyActionText}>Add your first login</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.footer}>
            <Sparkles size={15} color={colors.primary} />
            <Text style={styles.footerText}>Your vault is stored on this device only.</Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={modalMode !== null}
        transparent
        animationType={modalMode === 'settings' ? 'fade' : 'slide'}
        onRequestClose={() => setModalMode(null)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalDismiss} onPress={() => setModalMode(null)} />
          {modalMode === 'editor' && (
            <View style={[styles.modalSheet, isTablet && styles.modalSheetTablet]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>{editingItem ? 'UPDATE ENTRY' : 'NEW ENTRY'}</Text>
                  <Text style={styles.modalTitle}>
                    {editingItem ? 'Edit login' : 'Add to your vault'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setModalMode(null)}
                  style={styles.closeButton}
                >
                  <X size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <FormField
                  label="APP OR WEBSITE NAME"
                  value={draft.name}
                  placeholder="e.g. Notion, your bank, anything"
                  onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
                  styles={styles}
                  placeholderColor={colors.mutedForeground}
                  testID="credential-name"
                />
                <FormField
                  label="USERNAME OR EMAIL"
                  value={draft.username}
                  placeholder="name@example.com"
                  onChangeText={(value) => setDraft((current) => ({ ...current, username: value }))}
                  styles={styles}
                  placeholderColor={colors.mutedForeground}
                  autoCapitalize="none"
                  testID="credential-username"
                />
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>PASSWORD</Text>
                  <Pressable onPress={() => void generatePassword()} style={styles.generatorButton}>
                    <Sparkles size={13} color={colors.primary} />
                    <Text style={styles.generatorText}>Generate</Text>
                  </Pressable>
                </View>
                <View style={styles.inputWrap}>
                  <KeyRound size={17} color={colors.mutedForeground} />
                  <TextInput
                    value={draft.password}
                    onChangeText={(value) => setDraft((current) => ({ ...current, password: value }))}
                    style={styles.textInput}
                    placeholder="Enter password"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="credential-password"
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    hitSlop={10}
                  >
                    {passwordVisible ? (
                      <EyeOff size={18} color={colors.mutedForeground} />
                    ) : (
                      <Eye size={18} color={colors.mutedForeground} />
                    )}
                  </Pressable>
                </View>
                <FormField
                  label="WEBSITE (OPTIONAL)"
                  value={draft.url}
                  placeholder="example.com"
                  onChangeText={(value) => setDraft((current) => ({ ...current, url: value }))}
                  styles={styles}
                  placeholderColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
                <FormField
                  label="TAGS (OPTIONAL)"
                  value={draft.tagsText}
                  placeholder="socialmedia, entertainment"
                  onChangeText={(value) => setDraft((current) => ({ ...current, tagsText: value }))}
                  styles={styles}
                  placeholderColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
                <FormField
                  label="PRIVATE NOTE (OPTIONAL)"
                  value={draft.notes}
                  placeholder="Anything useful to remember"
                  onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
                  styles={styles}
                  placeholderColor={colors.mutedForeground}
                  multiline
                />
                {!!formError && <Text style={styles.errorText}>{formError}</Text>}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void saveDraft()}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.formSaveButton,
                    pressed && styles.pressed,
                    busy && styles.disabledButton,
                  ]}
                  testID="save-credential"
                >
                  {busy ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Check size={18} color={colors.primaryForeground} />
                      <Text style={styles.primaryButtonText}>
                        {editingItem ? 'Save changes' : 'Save securely'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          )}
          {modalMode === 'settings' && (
            <View style={[styles.settingsSheet, isTablet && styles.settingsSheetTablet]}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>PREFERENCES</Text>
                  <Text style={styles.modalTitle}>Vault settings</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close settings"
                  onPress={() => setModalMode(null)}
                  style={styles.closeButton}
                >
                  <X size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>APPEARANCE</Text>
                <View style={styles.appearanceOptions}>
                  <AppearanceOption
                    selected={appearance === 'dark'}
                    label="Dark"
                    onPress={() => void changeAppearance('dark')}
                    styles={styles}
                    checkColor={colors.primary}
                    icon={<Moon size={16} color={appearance === 'dark' ? colors.primary : colors.mutedForeground} />}
                  />
                  <AppearanceOption
                    selected={appearance === 'light'}
                    label="Light"
                    onPress={() => void changeAppearance('light')}
                    styles={styles}
                    checkColor={colors.primary}
                    icon={<Sun size={16} color={appearance === 'light' ? colors.primary : colors.mutedForeground} />}
                  />
                </View>
              </View>
              <View style={styles.settingDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Fingerprint size={19} color={colors.primary} />
                </View>
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>Biometric unlock</Text>
                  <Text style={styles.settingDetail}>Use Face ID or fingerprint on this device</Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: biometricsEnabled }}
                  accessibilityLabel="Biometric unlock"
                  onPress={() => void toggleBiometrics()}
                  disabled={busy}
                  style={[styles.switchTrack, biometricsEnabled && styles.switchTrackActive]}
                  testID="toggle-biometrics"
                >
                  <View style={[styles.switchThumb, biometricsEnabled && styles.switchThumbActive]} />
                </Pressable>
              </View>
              {!!appearanceMessage && (
                <Text style={styles.settingMessage}>{appearanceMessage}</Text>
              )}
              <View style={styles.settingDivider} />
              <View style={styles.storageCard}>
                <ShieldCheck size={18} color={colors.success} />
                <View style={styles.storageCopy}>
                  <Text style={styles.storageTitle}>Stored on this device</Text>
                  <Text style={styles.storageDetail}>
                    Your entries are encrypted with AES-GCM. Keeper has no access to your master password.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setModalMode(null);
                  lockVault();
                }}
                style={({ pressed }) => [styles.lockNowButton, pressed && styles.pressed]}
              >
                <LockKeyhole size={17} color={colors.mutedForeground} />
                <Text style={styles.lockNowText}>Lock vault now</Text>
              </Pressable>
              <Text style={styles.settingsFootnote}>
                If you forget your master password, your encrypted entries cannot be recovered.
              </Text>
            </View>
          )}
          {modalMode === 'delete' && deleteTarget && (
            <View style={[styles.confirmSheet, isTablet && styles.confirmSheetTablet]}>
              <View style={styles.modalHandle} />
              <View style={styles.deleteIcon}>
                <Trash2 size={21} color={colors.destructive} />
              </View>
              <Text style={styles.modalTitle}>Delete {deleteTarget.name}?</Text>
              <Text style={styles.confirmDescription}>
                This permanently removes this login from your encrypted vault on this device.
              </Text>
              {!!formError && <Text style={styles.errorText}>{formError}</Text>}
              <Pressable
                accessibilityRole="button"
                onPress={() => void confirmDelete()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressed,
                  busy && styles.disabledButton,
                ]}
                testID="confirm-delete"
              >
                {busy ? (
                  <ActivityIndicator color={colors.destructiveForeground} />
                ) : (
                  <Text style={styles.deleteButtonText}>Delete login</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => {
                  setModalMode(null);
                  setDeleteTarget(null);
                }}
                style={styles.cancelDeleteButton}
              >
                <Text style={styles.cancelDeleteText}>Keep it</Text>
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function TagChip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tagChip, selected && styles.tagChipSelected]}
    >
      <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function CredentialCard({
  item,
  isRevealed,
  isTablet,
  styles,
  colors,
  onToggleReveal,
  onEdit,
  onDelete,
}: {
  item: VaultItem;
  isRevealed: boolean;
  isTablet: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useColors>;
  onToggleReveal: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initial = item.name.trim().charAt(0).toLocaleUpperCase() || '•';
  return (
    <View style={[styles.credentialCard, isTablet && styles.credentialCardTablet]}>
      <View style={styles.cardTopline}>
        <View style={styles.appIdentity}>
          <View style={styles.appIcon}>
            <Text style={styles.appInitial}>{initial}</Text>
          </View>
          <View style={styles.appTitleGroup}>
            <Text style={styles.appName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.appUrl} numberOfLines={1}>{item.url || 'Personal account'}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            onPress={onEdit}
            hitSlop={9}
            style={styles.cardIconButton}
            testID={`edit-${item.id}`}
          >
            <Pencil size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            onPress={onDelete}
            hitSlop={9}
            style={styles.cardIconButton}
            testID={`delete-${item.id}`}
          >
            <Trash2 size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <View style={styles.credentialDetails}>
        <View style={styles.credentialValue}>
          <Text style={styles.valueLabel}>USERNAME</Text>
          <Text style={[styles.valueText, !isRevealed && styles.maskedValue]} numberOfLines={1}>
            {isRevealed ? item.username || 'Not added' : '••••••••••••'}
          </Text>
        </View>
        <View style={styles.credentialValue}>
          <Text style={styles.valueLabel}>PASSWORD</Text>
          <Text style={[styles.valueText, styles.passwordValue, !isRevealed && styles.maskedValue]} numberOfLines={1}>
            {isRevealed ? item.password || 'Not added' : '••••••••••••'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isRevealed ? 'Hide' : 'Reveal'} ${item.name} credentials`}
          accessibilityState={{ expanded: isRevealed }}
          onPress={onToggleReveal}
          style={({ pressed }) => [styles.revealButton, pressed && styles.pressed]}
          testID={`reveal-${item.id}`}
        >
          {isRevealed ? (
            <EyeOff size={17} color={colors.primary} />
          ) : (
            <Eye size={17} color={colors.primary} />
          )}
          <Text style={styles.revealLabel}>{isRevealed ? 'Hide' : 'Reveal'}</Text>
        </Pressable>
      </View>

      {!!item.tags.length && (
        <View style={styles.cardTags}>
          {item.tags.map((tag) => (
            <View key={tag} style={styles.cardTag}>
              <Text style={styles.cardTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
      {isRevealed && !!item.notes && <Text style={styles.privateNote}>{item.notes}</Text>}
    </View>
  );
}

function FormField({
  label,
  value,
  placeholder,
  onChangeText,
  styles,
  placeholderColor,
  autoCapitalize = 'sentences',
  multiline = false,
  testID,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof makeStyles>;
  placeholderColor: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.multilineInputWrap]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={[styles.textInput, multiline && styles.multilineInput]}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          testID={testID}
        />
      </View>
    </View>
  );
}

function AppearanceOption({
  selected,
  label,
  onPress,
  styles,
  checkColor,
  icon,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  checkColor: string;
  icon: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.appearanceOption, selected && styles.appearanceOptionSelected]}
    >
      {icon}
      <Text style={[styles.appearanceOptionText, selected && styles.appearanceOptionTextSelected]}>
        {label}
      </Text>
      {selected && <Check size={15} color={checkColor} />}
    </Pressable>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    loadingMark: { width: 68, height: 68, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
    pageContent: { flexGrow: 1, paddingHorizontal: 20 },
    page: { width: '100%', maxWidth: 1030, alignSelf: 'center' },
    lockContent: { flexGrow: 1, paddingHorizontal: 22, justifyContent: 'center' },
    lockPage: { width: '100%', maxWidth: 470, alignSelf: 'center' },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logo: { width: 38, height: 38, borderRadius: 12 },
    brandName: { color: colors.foreground, fontSize: 21, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
    localPill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 30 },
    localDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: colors.success },
    localLabel: { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.9 },
    lockHero: { alignItems: 'center', marginTop: 47, marginBottom: 29 },
    lockIconHalo: { width: 66, height: 66, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, marginBottom: 21 },
    lockEyebrow: { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8, marginBottom: 11 },
    lockTitle: { color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 29, letterSpacing: -1.1, textAlign: 'center' },
    lockSubtitle: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 330, marginTop: 11 },
    lockPanel: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 22, shadowColor: colors.shadow, shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
    fieldLabel: { color: colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.15, marginBottom: 9 },
    secondFieldLabel: { marginTop: 18 },
    inputWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.background, borderRadius: 14 },
    textInput: { flex: 1, color: colors.foreground, paddingVertical: 13, fontFamily: 'Inter_400Regular', fontSize: 14, minWidth: 0 },
    primaryButton: { minHeight: 52, marginTop: 20, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
    primaryButtonText: { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
    pressed: { opacity: 0.78 },
    disabledButton: { opacity: 0.58 },
    errorText: { color: colors.destructive, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, marginTop: 11 },
    biometricButton: { minHeight: 47, marginTop: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9 },
    biometricText: { color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    securityNotes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 17, marginTop: 24 },
    securityNote: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    securityNoteText: { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 11 },
    recoveryNote: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 21, paddingHorizontal: 18 },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    encryptedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 30, paddingHorizontal: 10, paddingVertical: 7 },
    encryptedBadgeText: { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 10 },
    iconAction: { width: 30, height: 38, alignItems: 'center', justifyContent: 'center' },
    introRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 38, marginBottom: 24 },
    introCopy: { flex: 1 },
    eyebrow: { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.7, marginBottom: 8 },
    pageTitle: { color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 34, letterSpacing: -1.5 },
    pageSubtitle: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 7 },
    vaultCount: { alignItems: 'flex-end', paddingBottom: 3 },
    vaultCountNumber: { color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.5 },
    vaultCountCaption: { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 8, letterSpacing: 1.4, marginTop: 2 },
    searchWrap: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16 },
    searchInput: { flex: 1, minWidth: 0, color: colors.foreground, fontFamily: 'Inter_400Regular', fontSize: 13, paddingVertical: 15 },
    filterHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 11 },
    filterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    filterHeadingText: { color: colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1 },
    resultCount: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11 },
    tagRail: { flexDirection: 'row', gap: 8, paddingBottom: 1 },
    tagChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 30 },
    tagChipSelected: { borderColor: colors.primary, backgroundColor: colors.accent },
    tagChipText: { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 11 },
    tagChipTextSelected: { color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' },
    listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 14 },
    listTitle: { color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
    listSubtitle: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 },
    addButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 13, borderRadius: 13, backgroundColor: colors.primary },
    addButtonText: { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
    credentialCard: { width: '100%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 19, padding: 16 },
    credentialCardTablet: { width: '47%' },
    cardTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    appIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
    appIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
    appInitial: { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 16 },
    appTitleGroup: { flex: 1, minWidth: 0 },
    appName: { color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
    appUrl: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 11, marginLeft: 8 },
    cardIconButton: { minWidth: 25, minHeight: 30, alignItems: 'center', justifyContent: 'center' },
    credentialDetails: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
    credentialValue: { flex: 1, minWidth: 0 },
    valueLabel: { color: colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1, marginBottom: 7 },
    valueText: { color: colors.foreground, fontFamily: 'Inter_500Medium', fontSize: 11 },
    passwordValue: { letterSpacing: 0.3 },
    maskedValue: { color: colors.mutedForeground, letterSpacing: 1.7 },
    revealButton: { minHeight: 38, minWidth: 49, alignItems: 'center', justifyContent: 'center', gap: 3 },
    revealLabel: { color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 8 },
    cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 15 },
    cardTag: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.surfaceAlt },
    cardTagText: { color: colors.secondaryForeground, fontFamily: 'Inter_500Medium', fontSize: 9 },
    privateNote: { color: colors.mutedForeground, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 11, marginTop: 13, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
    emptyState: { alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', paddingHorizontal: 26, paddingVertical: 40, backgroundColor: colors.surface },
    emptyIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
    emptyTitle: { color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    emptyDescription: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7, maxWidth: 260 },
    emptyAction: { marginTop: 17, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 11, backgroundColor: colors.accent },
    emptyActionText: { color: colors.accentForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 27 },
    footerText: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10 },
    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4, 8, 15, 0.62)' },
    modalDismiss: StyleSheet.absoluteFill,
    modalSheet: { width: '100%', maxHeight: '92%', backgroundColor: colors.background, borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 20, paddingBottom: 28 },
    modalSheetTablet: { maxWidth: 600, alignSelf: 'center', borderRadius: 27, marginBottom: 26 },
    modalHandle: { width: 38, height: 4, borderRadius: 4, backgroundColor: colors.border, alignSelf: 'center', marginTop: 11, marginBottom: 17 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
    modalEyebrow: { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.5, marginBottom: 6 },
    modalTitle: { color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.5 },
    closeButton: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center' },
    formScroll: { flexGrow: 0 },
    formContent: { paddingBottom: 3 },
    formField: { marginBottom: 14 },
    multilineInputWrap: { alignItems: 'flex-start', minHeight: 85 },
    multilineInput: { minHeight: 78, paddingTop: 12 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1 },
    generatorButton: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
    generatorText: { color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
    formSaveButton: { marginTop: 3, marginBottom: 10 },
    settingsSheet: { width: '100%', backgroundColor: colors.background, borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 22, paddingBottom: 29 },
    settingsSheetTablet: { maxWidth: 560, alignSelf: 'center', borderRadius: 27, marginBottom: 35 },
    settingGroup: { marginTop: 3 },
    settingLabel: { color: colors.mutedForeground, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, marginBottom: 11 },
    appearanceOptions: { flexDirection: 'row', gap: 10 },
    appearanceOption: { flex: 1, minHeight: 43, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
    appearanceOptionSelected: { borderColor: colors.primary, backgroundColor: colors.accent },
    appearanceOptionText: { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12 },
    appearanceOptionTextSelected: { color: colors.accentForeground, fontFamily: 'Inter_600SemiBold' },
    settingDivider: { height: 1, backgroundColor: colors.border, marginVertical: 19 },
    settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    settingIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
    settingCopy: { flex: 1 },
    settingTitle: { color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    settingDetail: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 },
    switchTrack: { width: 42, height: 25, borderRadius: 15, backgroundColor: colors.muted, justifyContent: 'center', paddingHorizontal: 3 },
    switchTrackActive: { backgroundColor: colors.primary },
    switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.cardForeground },
    switchThumbActive: { alignSelf: 'flex-end', backgroundColor: colors.primaryForeground },
    settingMessage: { color: colors.primary, fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 12 },
    storageCard: { flexDirection: 'row', gap: 12, backgroundColor: colors.surfaceAlt, borderRadius: 15, padding: 14 },
    storageCopy: { flex: 1 },
    storageTitle: { color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    storageDetail: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, marginTop: 5 },
    lockNowButton: { minHeight: 46, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 13 },
    lockNowText: { color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    settingsFootnote: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 13, paddingHorizontal: 14 },
    confirmSheet: { width: '100%', alignItems: 'center', backgroundColor: colors.background, borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 25, paddingBottom: 29 },
    confirmSheetTablet: { maxWidth: 430, alignSelf: 'center', borderRadius: 27, marginBottom: 35 },
    deleteIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    confirmDescription: { color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, maxWidth: 300 },
    deleteButton: { minHeight: 48, width: '100%', marginTop: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.destructive, borderRadius: 14 },
    deleteButtonText: { color: colors.destructiveForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    cancelDeleteButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
    cancelDeleteText: { color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  });
}