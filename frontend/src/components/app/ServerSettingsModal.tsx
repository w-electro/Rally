import { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  Shield,
  Users,
  Link,
  Copy,
  Check,
  Loader2,
  Camera,
  Globe,
  Lock,
  Plus,
  Crown,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { cn, getInitials, getStatusColor } from '@/lib/utils';
import type { ServerMember, Role } from '@/lib/types';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Settings },
  { id: 'ranks', label: 'Ranks', icon: Shield },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'invites', label: 'Invites', icon: Link },
];

export function ServerSettingsModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const activeServer = useServerStore((s) => s.activeServer);
  const members = useServerStore((s) => s.members);
  const loadMembers = useServerStore((s) => s.loadMembers);
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState('overview');

  // Overview state
  const [serverName, setServerName] = useState(activeServer?.name || '');
  const [serverDescription, setServerDescription] = useState(activeServer?.description || '');
  const [isPublic, setIsPublic] = useState(activeServer?.isPublic || false);
  const [serverIconPreview, setServerIconPreview] = useState<string | null>(activeServer?.iconUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // Invite state
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeServer) {
      loadMembers(activeServer.id);
    }
  }, [activeServer, loadMembers]);

  const isOwner = user?.id === activeServer?.ownerId;

  const handleSaveOverview = async () => {
    if (!activeServer) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.updateServer(activeServer.id, {
        name: serverName.trim(),
        description: serverDescription.trim() || undefined,
        isPublic,
        iconUrl: serverIconPreview || undefined,
      });
      // Update the store
      const { setActiveServer } = useServerStore.getState();
      await setActiveServer({ ...activeServer, name: serverName.trim(), description: serverDescription.trim(), isPublic, iconUrl: serverIconPreview || undefined });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // silently fail
    }
    setIsSaving(false);
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setServerIconPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateInvite = async () => {
    if (!activeServer) return;
    setIsCreatingInvite(true);
    try {
      const data = await api.createInvite(activeServer.id);
      setInviteCode((data as any).code);
    } catch {
      // silently fail
    }
    setIsCreatingInvite(false);
  };

  const handleCopyInvite = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Permission bit labels
  const permissionLabels: Record<string, string> = {
    '1': 'Admin',
    '2': 'Manage Server',
    '4': 'Manage Channels',
    '8': 'Manage Ranks',
    '16': 'Kick Members',
    '32': 'Ban Members',
    '64': 'Manage Messages',
    '128': 'Mention Everyone',
    '256': 'Send Messages',
    '512': 'Read Messages',
  };

  const parsePermissions = (permBigInt: string): string[] => {
    try {
      const val = BigInt(permBigInt);
      const labels: string[] = [];
      for (const [bit, label] of Object.entries(permissionLabels)) {
        if (val & BigInt(bit)) {
          labels.push(label);
        }
      }
      if (labels.length === 0) return ['No permissions'];
      return labels;
    } catch {
      return ['Default'];
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex">
      {/* Sidebar */}
      <div className="w-56 bg-[#0D1117] border-r border-rally-border flex flex-col">
        <div className="p-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-rally-text-muted">
            Server Settings
          </h2>
          {activeServer && (
            <p className="text-xs text-rally-blue mt-1 truncate">{activeServer.name}</p>
          )}
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors',
                activeTab === tab.id
                  ? 'bg-rally-blue/10 text-rally-blue'
                  : 'text-rally-text-muted hover:text-rally-text hover:bg-white/5'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-rally-text">
            {TABS.find((t) => t.id === activeTab)?.label}
          </h1>
          <button
            onClick={closeModal}
            className="p-2 rounded hover:bg-white/10 text-rally-text-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* === OVERVIEW TAB === */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Server Icon Upload */}
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-3">
                Server Icon
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => iconInputRef.current?.click()}
                  className="relative group w-20 h-20 rounded-full overflow-hidden bg-[#1A1F36] border-2 border-dashed border-white/20 hover:border-rally-blue/50 transition-colors flex-shrink-0"
                  title="Click to upload server icon"
                >
                  {serverIconPreview ? (
                    <img
                      src={serverIconPreview}
                      alt="Server icon"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-display font-bold text-white/50">
                      {serverName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </button>
                <div>
                  <p className="text-sm text-rally-text-muted">
                    Click to upload. PNG or JPG, max 2MB.
                  </p>
                  {serverIconPreview && serverIconPreview !== activeServer?.iconUrl && (
                    <button
                      onClick={() => setServerIconPreview(activeServer?.iconUrl || null)}
                      className="text-xs text-rally-magenta hover:underline mt-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleIconUpload}
              />
            </div>

            {/* Server Name */}
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">
                Server Name <span className="text-rally-magenta">*</span>
              </label>
              <input
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="input-rally rounded w-full"
                maxLength={100}
                disabled={!isOwner}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">
                Description
              </label>
              <textarea
                value={serverDescription}
                onChange={(e) => setServerDescription(e.target.value)}
                className="input-rally rounded h-24 resize-none w-full"
                placeholder="What's your server about?"
                maxLength={1024}
                disabled={!isOwner}
              />
            </div>

            {/* Visibility toggle */}
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-2">
                Visibility
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => isOwner && setIsPublic(false)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-sm border transition-colors text-sm font-body',
                    !isPublic
                      ? 'border-rally-blue bg-rally-blue/10 text-rally-blue'
                      : 'border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60',
                    !isOwner && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Lock className="w-4 h-4" />
                  Private
                </button>
                <button
                  type="button"
                  onClick={() => isOwner && setIsPublic(true)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-sm border transition-colors text-sm font-body',
                    isPublic
                      ? 'border-rally-green bg-rally-green/10 text-rally-green'
                      : 'border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60',
                    !isOwner && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Globe className="w-4 h-4" />
                  Public
                </button>
              </div>
            </div>

            {/* Save Button */}
            {isOwner && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveOverview}
                  disabled={isSaving || !serverName.trim()}
                  className="btn-rally-primary px-6 py-2"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                {saveSuccess && (
                  <span className="text-sm text-rally-green flex items-center gap-1">
                    <Check className="w-4 h-4" /> Saved!
                  </span>
                )}
              </div>
            )}

            {!isOwner && (
              <p className="text-xs text-rally-text-muted italic">
                Only the server owner can edit these settings.
              </p>
            )}
          </div>
        )}

        {/* === RANKS TAB === */}
        {activeTab === 'ranks' && (
          <div className="space-y-4">
            <p className="text-sm text-rally-text-muted mb-4">
              Ranks define what members can do in this server. Higher position = higher priority.
            </p>

            {activeServer?.roles && activeServer.roles.length > 0 ? (
              <div className="space-y-2">
                {[...activeServer.roles]
                  .sort((a, b) => b.position - a.position)
                  .map((role: Role) => (
                    <div
                      key={role.id}
                      className="card-rally rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: role.color || '#8B949E' }}
                        />
                        <h3 className="font-display font-semibold text-rally-text">
                          {role.name}
                        </h3>
                        {role.isDefault && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-rally-blue/10 text-rally-blue font-display">
                            Default
                          </span>
                        )}
                        <span className="text-[10px] text-rally-text-muted ml-auto">
                          Position: {role.position}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {parsePermissions(role.permissions).map((perm) => (
                          <span
                            key={perm}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-rally-text-muted"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No ranks configured yet.</p>
                <p className="text-white/20 text-xs mt-1">
                  Ranks will appear here once they are created via the API.
                </p>
              </div>
            )}
          </div>
        )}

        {/* === MEMBERS TAB === */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-rally-text-muted">
                {members.length} member{members.length !== 1 ? 's' : ''} in this server
              </p>
            </div>

            <div className="space-y-1">
              {members.map((member: ServerMember) => {
                const mIsOwner = member.userId === activeServer?.ownerId;
                const memberRoles = member.roles?.map((r) => r.role) || [];

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-[#1A1F36] flex items-center justify-center text-xs font-bold text-white/70">
                        {member.user.avatarUrl ? (
                          <img
                            src={member.user.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          getInitials(member.user.displayName)
                        )}
                      </div>
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0D1117]"
                        style={{
                          backgroundColor: getStatusColor(member.user.status ?? 'OFFLINE'),
                        }}
                      />
                    </div>

                    {/* Name & info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">
                          {member.nickname || member.user.displayName}
                        </span>
                        {mIsOwner && (
                          <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-white/30">@{member.user.username}</span>
                    </div>

                    {/* Ranks */}
                    <div className="flex gap-1 flex-shrink-0">
                      {memberRoles.map((role: Role) => (
                        <span
                          key={role.id}
                          className="text-[10px] px-2 py-0.5 rounded-full font-display"
                          style={{
                            backgroundColor: `${role.color || '#8B949E'}20`,
                            color: role.color || '#8B949E',
                            border: `1px solid ${role.color || '#8B949E'}40`,
                          }}
                        >
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {members.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No members loaded.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === INVITES TAB === */}
        {activeTab === 'invites' && (
          <div className="space-y-6">
            <p className="text-sm text-rally-text-muted">
              Generate invite codes to let others join this server.
            </p>

            {/* Create invite */}
            <div className="card-rally rounded-lg p-5 border border-white/5">
              <h3 className="font-display font-semibold text-rally-text mb-3">
                Create New Invite
              </h3>
              {!inviteCode ? (
                <button
                  onClick={handleCreateInvite}
                  disabled={isCreatingInvite}
                  className="btn-rally-primary px-5 py-2 text-sm flex items-center gap-2"
                >
                  {isCreatingInvite ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Generate Invite Code
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-black/40 border border-white/10 rounded-sm">
                      <Link className="w-4 h-4 text-rally-blue shrink-0" />
                      <span className="text-lg font-display font-bold tracking-widest text-rally-blue select-all">
                        {inviteCode}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyInvite}
                      className={cn(
                        'shrink-0 flex items-center justify-center w-12 h-12 rounded-sm border transition-all duration-200',
                        copied
                          ? 'border-rally-green bg-rally-green/10 text-rally-green'
                          : 'border-rally-blue/30 bg-rally-blue/10 text-rally-blue hover:bg-rally-blue/20'
                      )}
                    >
                      {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  {copied && (
                    <p className="text-xs text-rally-green">Copied to clipboard!</p>
                  )}
                  <button
                    onClick={() => {
                      setInviteCode(null);
                      setCopied(false);
                    }}
                    className="text-xs text-rally-text-muted hover:text-rally-text transition-colors"
                  >
                    Generate another
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
