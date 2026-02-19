import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { X, User, Shield, Gamepad2, Bell, Volume2, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audio', label: 'Voice & Audio', icon: Volume2 },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

interface UserSettingsProps {
  onClose: () => void;
}

export function UserSettings({ onClose }: UserSettingsProps) {
  const { user, updateUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await api.updateProfile({ displayName, bio, customStatus });
      updateUser({ displayName, bio, customStatus });
    } catch {}
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex">
      {/* Sidebar */}
      <div className="w-56 bg-[#0D1117] border-r border-rally-border flex flex-col">
        <div className="p-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-rally-text-muted">Settings</h2>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors',
                activeTab === tab.id ? 'bg-rally-blue/10 text-rally-blue' : 'text-rally-text-muted hover:text-rally-text hover:bg-white/5'
              )}
            >
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-rally-border">
          <button onClick={async () => { const { useAuthStore: s } = await import('@/stores/authStore'); s.getState().logout(); onClose(); }} className="btn-rally-danger w-full text-xs">Log Out</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-rally-text">
            {TABS.find((t) => t.id === activeTab)?.label}
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
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rally-blue to-rally-green border-4 border-[#0D1117] flex items-center justify-center text-black font-bold text-2xl">
                  {user?.displayName?.[0]?.toUpperCase() || '?'}
                </div>
                <p className="mt-2 text-lg font-display font-bold text-rally-text">{user?.displayName}</p>
                <p className="text-sm text-rally-text-muted">@{user?.username}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Display Name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input-rally rounded" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Custom Status</label>
              <input value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} className="input-rally rounded" placeholder="What are you up to?" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Bio</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input-rally rounded h-24 resize-none" placeholder="Tell everyone about yourself..." />
            </div>
            <button onClick={handleSaveProfile} disabled={isSaving} className="btn-rally-primary px-6 py-2">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <ToggleSetting label="Allow DMs from server members" description="Let anyone in your servers send you direct messages" defaultChecked />
            <ToggleSetting label="Allow friend requests" description="Allow others to send you friend requests" defaultChecked />
            <ToggleSetting label="Show online status" description="Let others see when you're online" defaultChecked />
            <ToggleSetting label="Show current game" description="Display what game you're currently playing" defaultChecked />
            <ToggleSetting label="Enable E2E encryption for DMs" description="Encrypt all direct messages end-to-end" />
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <ToggleSetting label="Desktop notifications" description="Show desktop notifications for messages" defaultChecked />
            <ToggleSetting label="Sound notifications" description="Play sounds for new messages" defaultChecked />
            <ToggleSetting label="Rally calls" description="Get notified when someone starts a rally call" defaultChecked />
            <ToggleSetting label="Stream alerts" description="Get notified when friends go live" defaultChecked />
            <ToggleSetting label="Mention highlights" description="Get notified when you're mentioned" defaultChecked />
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-2">Input Volume</label>
              <input type="range" min="0" max="100" defaultValue="80" className="w-full accent-rally-blue" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-2">Output Volume</label>
              <input type="range" min="0" max="100" defaultValue="100" className="w-full accent-rally-blue" />
            </div>
            <ToggleSetting label="Push to talk" description="Hold a key to transmit your voice" />
            <ToggleSetting label="Noise suppression" description="Filter out background noise" defaultChecked />
            <ToggleSetting label="Echo cancellation" description="Prevent echo from speakers" defaultChecked />
          </div>
        )}

        {activeTab === 'gaming' && (
          <div className="space-y-4">
            <ToggleSetting label="Game activity detection" description="Automatically detect and show what game you're playing" defaultChecked />
            <div className="card-rally rounded-lg p-4">
              <h3 className="font-display font-semibold text-rally-text mb-2">Linked Accounts</h3>
              <p className="text-sm text-rally-text-muted">Connect your gaming accounts to show stats and activity.</p>
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
            <div className="card-rally rounded-lg p-4">
              <h3 className="font-display font-semibold text-rally-text mb-2">Theme</h3>
              <p className="text-sm text-rally-text-muted">Rally's aggressive esports aesthetic. Additional themes coming soon.</p>
              <div className="mt-3 flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-black border-2 border-rally-blue flex items-center justify-center">
                  <span className="text-[10px] text-rally-blue font-bold">DARK</span>
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
