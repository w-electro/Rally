import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { X, User, Shield, Gamepad2, Bell, Volume2, Palette, Camera, Check, Mic, Speaker, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const TAB_KEYS = [
  { id: 'profile', key: 'settings.profile', icon: User },
  { id: 'privacy', key: 'settings.privacy', icon: Shield },
  { id: 'gaming', key: 'settings.gaming', icon: Gamepad2 },
  { id: 'notifications', key: 'settings.notifications', icon: Bell },
  { id: 'audio', key: 'settings.voiceAudio', icon: Volume2 },
  { id: 'appearance', key: 'settings.appearance', icon: Palette },
];

interface UserSettingsProps {
  onClose: () => void;
}

export function UserSettings({ onClose }: UserSettingsProps) {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Voice & Audio state (persisted to localStorage)
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string>(() => localStorage.getItem('rally-audio-input') || 'default');
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>(() => localStorage.getItem('rally-audio-output') || 'default');
  const [inputVolume, setInputVolume] = useState(() => Number(localStorage.getItem('rally-audio-input-vol')) || 80);
  const [outputVolume, setOutputVolume] = useState(() => Number(localStorage.getItem('rally-audio-output-vol')) || 100);

  // Enumerate audio devices when Voice & Audio tab is active
  useEffect(() => {
    if (activeTab !== 'audio') return;

    const enumerateDevices = async () => {
      try {
        // Request permission first (needed to get device labels)
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
        });

        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputDevices(devices.filter((d) => d.kind === 'audioinput'));
        setAudioOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
      } catch {
        // Permission denied or no devices
      }
    };

    enumerateDevices();
  }, [activeTab]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const profileData: Record<string, any> = {
        displayName,
        bio,
        customStatus,
      };
      // Include avatar if it changed
      if (avatarPreview !== (user?.avatarUrl || null)) {
        profileData.avatarUrl = avatarPreview;
      }
      await api.updateProfile(profileData);
      updateUser({ displayName, bio, customStatus, avatarUrl: avatarPreview || undefined });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {}
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex">
      {/* Sidebar */}
      <div className="w-56 bg-[#0D1117] border-r border-rally-border flex flex-col">
        <div className="p-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-rally-text-muted">{t('settings.settings')}</h2>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors',
                activeTab === tab.id ? 'bg-rally-blue/10 text-rally-blue' : 'text-rally-text-muted hover:text-rally-text hover:bg-white/5'
              )}
            >
              <tab.icon className="w-4 h-4" />{t(tab.key)}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-rally-border">
          <button onClick={async () => { const { useAuthStore: s } = await import('@/stores/authStore'); s.getState().logout(); onClose(); }} className="btn-rally-danger w-full text-xs">{t('settings.logOut')}</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-rally-text">
            {t(TAB_KEYS.find((tab) => tab.id === activeTab)?.key ?? '')}
          </h1>
          <button onClick={onClose} className="p-2 rounded hover:bg-white/10 text-rally-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Avatar & Banner */}
            <div className="card-rally rounded-lg overflow-hidden">
              <div className="h-28 bg-gradient-to-r from-rally-blue/30 to-rally-purple/30" />
              <div className="px-4 pb-4 -mt-10">
                {/* Clickable Avatar */}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative group w-20 h-20 rounded-full border-4 border-[#0D1117] overflow-hidden flex-shrink-0"
                  title="Click to upload avatar"
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-rally-blue to-rally-green flex items-center justify-center text-black font-bold text-2xl">
                      {user?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <p className="mt-2 text-lg font-display font-bold text-rally-text">{user?.displayName}</p>
                <p className="text-sm text-rally-text-muted">@{user?.username}</p>
                {avatarPreview && avatarPreview !== (user?.avatarUrl || null) && (
                  <p className="text-xs text-rally-green mt-1">New avatar selected - save to apply</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">{t('settings.displayName')}</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-rally rounded w-full" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">{t('settings.customStatus')}</label>
              <input value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} className="input-rally rounded w-full" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">{t('settings.bio')}</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input-rally rounded h-24 resize-none w-full" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveProfile} disabled={isSaving} className="btn-rally-primary px-6 py-2">
                {isSaving ? t('common.saving') : t('common.save')}
              </button>
              {saveSuccess && (
                <span className="text-sm text-rally-green flex items-center gap-1">
                  <Check className="w-4 h-4" /> {t('common.saved')}
                </span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <ToggleSetting label={t('settings.allowDms')} description={t('settings.allowDmsDesc')} defaultChecked />
            <ToggleSetting label={t('settings.allowFriendRequests')} description={t('settings.allowFriendRequestsDesc')} defaultChecked />
            <ToggleSetting label={t('settings.showOnline')} description={t('settings.showOnlineDesc')} defaultChecked />
            <ToggleSetting label={t('settings.showActivity')} description={t('settings.showActivityDesc')} defaultChecked />
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <ToggleSetting label={t('settings.desktopNotifications')} description={t('settings.desktopNotificationsDesc')} defaultChecked />
            <ToggleSetting label={t('settings.soundEffects')} description={t('settings.soundEffectsDesc')} defaultChecked />
            <ToggleSetting label={t('settings.mentionNotifications')} description={t('settings.mentionNotificationsDesc')} defaultChecked />
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-6">
            {/* Input Device Selection */}
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-2">
                <span className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5" />
                  {t('settings.inputDevice')}
                </span>
              </label>
              <select
                value={selectedInputDevice}
                onChange={(e) => { setSelectedInputDevice(e.target.value); localStorage.setItem('rally-audio-input', e.target.value); }}
                className="input-rally rounded w-full bg-[#0D1117] text-rally-text cursor-pointer"
              >
                <option value="default">{t('settings.systemDefault')}</option>
                {audioInputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone (${device.deviceId.slice(0, 8)})`}
                  </option>
                ))}
              </select>
              {audioInputDevices.length === 0 && (
                <p className="text-xs text-rally-text-muted mt-1">
                  No input devices detected. Microphone permission may be required.
                </p>
              )}
            </div>

            {/* Input Volume */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted">{t('settings.inputVolume')}</label>
                <span className="text-xs text-rally-blue font-display">{inputVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={inputVolume}
                onChange={(e) => { setInputVolume(Number(e.target.value)); localStorage.setItem('rally-audio-input-vol', e.target.value); }}
                className="w-full accent-rally-blue"
              />
            </div>

            {/* Output Device Selection */}
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-2">
                <span className="flex items-center gap-2">
                  <Speaker className="w-3.5 h-3.5" />
                  {t('settings.outputDevice')}
                </span>
              </label>
              <select
                value={selectedOutputDevice}
                onChange={(e) => { setSelectedOutputDevice(e.target.value); localStorage.setItem('rally-audio-output', e.target.value); }}
                className="input-rally rounded w-full bg-[#0D1117] text-rally-text cursor-pointer"
              >
                <option value="default">{t('settings.systemDefault')}</option>
                {audioOutputDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Speaker (${device.deviceId.slice(0, 8)})`}
                  </option>
                ))}
              </select>
              {audioOutputDevices.length === 0 && (
                <p className="text-xs text-rally-text-muted mt-1">
                  No output devices detected.
                </p>
              )}
            </div>

            {/* Output Volume */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted">{t('settings.outputVolume')}</label>
                <span className="text-xs text-rally-blue font-display">{outputVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={outputVolume}
                onChange={(e) => { setOutputVolume(Number(e.target.value)); localStorage.setItem('rally-audio-output-vol', e.target.value); }}
                className="w-full accent-rally-blue"
              />
            </div>

            {/* Voice Settings Toggles */}
            <div className="pt-2 border-t border-rally-border">
              <h3 className="font-display text-sm font-semibold text-rally-text mb-3">{t('settings.voiceProcessing')}</h3>
              <div className="space-y-1">
                <ToggleSetting label={t('settings.noiseSuppression')} description="" defaultChecked />
                <ToggleSetting label={t('settings.echoCancellation')} description="" defaultChecked />
                <ToggleSetting label={t('settings.autoGainControl')} description="" defaultChecked />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gaming' && (
          <div className="space-y-4">
            <ToggleSetting label={t('settings.gameActivity')} description={t('settings.gameActivityDesc')} defaultChecked />
            <div className="card-rally rounded-lg p-4">
              <h3 className="font-display font-semibold text-rally-text mb-2">{t('settings.linkedAccounts')}</h3>
              <p className="text-sm text-rally-text-muted">{t('settings.gameActivityDesc')}</p>
              <div className="mt-3 space-y-2">
                {['Steam', 'Epic Games', 'Riot Games', 'Battle.net'].map((platform) => (
                  <div key={platform} className="flex items-center justify-between py-2">
                    <span className="text-sm text-rally-text">{platform}</span>
                    <button className="text-xs px-3 py-1 rounded bg-white/5 text-rally-text-muted hover:bg-white/10 transition-colors">Connect</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-4">
            {/* Language Picker */}
            <div className="card-rally rounded-lg p-4">
              <h3 className="font-display font-semibold text-rally-text mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('settings.language')}
              </h3>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => i18n.changeLanguage('en')}
                  className={cn(
                    'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                    i18n.language === 'en'
                      ? 'border-rally-blue bg-rally-blue/10 text-rally-blue'
                      : 'border-rally-border text-rally-text-muted hover:border-white/20'
                  )}
                >
                  {t('settings.english')}
                </button>
                <button
                  onClick={() => i18n.changeLanguage('ar')}
                  className={cn(
                    'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors',
                    i18n.language === 'ar'
                      ? 'border-rally-blue bg-rally-blue/10 text-rally-blue'
                      : 'border-rally-border text-rally-text-muted hover:border-white/20'
                  )}
                >
                  {t('settings.arabic')}
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="card-rally rounded-lg p-4">
              <h3 className="font-display font-semibold text-rally-text mb-2">{t('settings.theme')}</h3>
              <div className="mt-3 flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-black border-2 border-rally-blue flex items-center justify-center">
                  <span className="text-[10px] text-rally-blue font-bold">{t('settings.dark')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, defaultChecked }: { label: string; description: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked || false);
  return (
    <div className="flex items-center justify-between py-3 border-b border-rally-border">
      <div>
        <p className="text-sm font-medium text-rally-text">{label}</p>
        <p className="text-xs text-rally-text-muted">{description}</p>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={cn('w-10 h-5 rounded-full transition-colors relative', checked ? 'bg-rally-green' : 'bg-rally-border')}
      >
        <div className={cn('w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}
