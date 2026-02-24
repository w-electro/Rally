import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  Pencil,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import api from '@/lib/api';
import { cn, getInitials, getStatusColor } from '@/lib/utils';
import type { ServerMember, Role } from '@/lib/types';

const TABS = [
  { id: 'overview', labelKey: 'server.overview', icon: Settings },
  { id: 'ranks', labelKey: 'server.ranks', icon: Shield },
  { id: 'members', labelKey: 'chat.members', icon: Users },
  { id: 'invites', labelKey: 'server.invites', icon: Link },
];

export function ServerSettingsModal() {
  const { t } = useTranslation();
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

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#00D9FF');
  const [rolePerms, setRolePerms] = useState<bigint>(0n);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ roleId: string; roleName: string } | null>(null);
  const [assignDropdownMember, setAssignDropdownMember] = useState<string | null>(null);
  const [roleActionLoading, setRoleActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (activeServer) {
      loadMembers(activeServer.id);
      loadRoles();
    }
  }, [activeServer, loadMembers]);

  const isOwner = user?.id === activeServer?.ownerId;

  const loadRoles = async () => {
    if (!activeServer) return;
    try {
      const data = await api.getRoles(activeServer.id);
      setRoles(Array.isArray(data) ? data : data?.roles ?? []);
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  };

  const openRoleForm = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleColor(role.color || '#00D9FF');
      try { setRolePerms(BigInt(role.permissions)); } catch { setRolePerms(0n); }
    } else {
      setEditingRole(null);
      setRoleName('');
      setRoleColor('#00D9FF');
      setRolePerms(0n);
    }
    setShowRoleForm(true);
  };

  const handleSaveRole = async () => {
    if (!activeServer || !roleName.trim()) return;
    setIsSavingRole(true);
    try {
      if (editingRole) {
        await api.updateRole(activeServer.id, editingRole.id, {
          name: roleName.trim(),
          color: roleColor,
          permissions: rolePerms.toString(),
        });
        useToastStore.getState().addToast('success', 'Role updated');
      } else {
        await api.createRole(activeServer.id, {
          name: roleName.trim(),
          color: roleColor,
          permissions: rolePerms.toString(),
        });
        useToastStore.getState().addToast('success', 'Role created');
      }
      await loadRoles();
      setShowRoleForm(false);
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to save role');
    }
    setIsSavingRole(false);
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!activeServer) return;
    setRoleActionLoading(roleId);
    try {
      await api.deleteRole(activeServer.id, roleId);
      await loadRoles();
      setConfirmDelete(null);
      useToastStore.getState().addToast('success', 'Role deleted');
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to delete role');
    }
    setRoleActionLoading(null);
  };

  const handleAssignRole = async (memberId: string, roleId: string) => {
    if (!activeServer) return;
    setRoleActionLoading(roleId);
    try {
      await api.assignRole(activeServer.id, memberId, roleId);
      loadMembers(activeServer.id);
      useToastStore.getState().addToast('success', 'Role assigned');
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to assign role');
    }
    setRoleActionLoading(null);
    setAssignDropdownMember(null);
  };

  const handleRemoveRole = async (memberId: string, roleId: string) => {
    if (!activeServer) return;
    setRoleActionLoading(roleId);
    try {
      await api.removeRole(activeServer.id, memberId, roleId);
      loadMembers(activeServer.id);
      useToastStore.getState().addToast('success', 'Role removed');
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to remove role');
    }
    setRoleActionLoading(null);
  };

  const togglePerm = (bit: bigint) => {
    setRolePerms((prev) => (prev & bit) ? prev & ~bit : prev | bit);
  };

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
      // Update both activeServer and servers list in one shot
      useServerStore.getState().updateServerLocal(activeServer.id, {
        name: serverName.trim(),
        description: serverDescription.trim(),
        isPublic,
        iconUrl: serverIconPreview || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to save server settings');
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
    } catch (err: any) {
      useToastStore.getState().addToast('error', err?.message || 'Failed to create invite');
    }
    setIsCreatingInvite(false);
  };

  const handleCopyInvite = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // All permission bits matching backend/src/utils/permissions.ts
  const PERMISSION_BITS: Array<{ bit: bigint; label: string; key: string }> = [
    { bit: 1n << 0n, label: 'Administrator', key: 'admin' },
    { bit: 1n << 1n, label: 'Manage Server', key: 'manageServer' },
    { bit: 1n << 2n, label: 'Manage Channels', key: 'manageChannels' },
    { bit: 1n << 3n, label: 'Manage Roles', key: 'manageRoles' },
    { bit: 1n << 4n, label: 'Manage Members', key: 'manageMembers' },
    { bit: 1n << 5n, label: 'Kick Members', key: 'kickMembers' },
    { bit: 1n << 6n, label: 'Ban Members', key: 'banMembers' },
    { bit: 1n << 7n, label: 'Create Invite', key: 'createInvite' },
    { bit: 1n << 8n, label: 'Send Messages', key: 'sendMessages' },
    { bit: 1n << 9n, label: 'Embed Links', key: 'embedLinks' },
    { bit: 1n << 10n, label: 'Attach Files', key: 'attachFiles' },
    { bit: 1n << 11n, label: 'Read Messages', key: 'readMessages' },
    { bit: 1n << 12n, label: 'Manage Messages', key: 'manageMessages' },
    { bit: 1n << 13n, label: 'Mention Everyone', key: 'mentionEveryone' },
    { bit: 1n << 14n, label: 'Use Reactions', key: 'useReactions' },
    { bit: 1n << 15n, label: 'Connect Voice', key: 'connectVoice' },
    { bit: 1n << 16n, label: 'Speak', key: 'speak' },
    { bit: 1n << 17n, label: 'Mute Members', key: 'muteMembers' },
    { bit: 1n << 18n, label: 'Deafen Members', key: 'deafenMembers' },
    { bit: 1n << 19n, label: 'Move Members', key: 'moveMembers' },
    { bit: 1n << 20n, label: 'Voice Activity', key: 'voiceActivity' },
    { bit: 1n << 21n, label: 'Stream', key: 'stream' },
    { bit: 1n << 22n, label: 'Manage Feed', key: 'manageFeed' },
    { bit: 1n << 23n, label: 'Post Feed', key: 'postFeed' },
    { bit: 1n << 24n, label: 'Manage Stories', key: 'manageStories' },
    { bit: 1n << 25n, label: 'Manage Points', key: 'managePoints' },
    { bit: 1n << 26n, label: 'Manage Commerce', key: 'manageCommerce' },
    { bit: 1n << 27n, label: 'Manage AI', key: 'manageAI' },
    { bit: 1n << 28n, label: 'View Analytics', key: 'viewAnalytics' },
  ];

  const COLOR_PRESETS = ['#FF006E', '#00D9FF', '#39FF14', '#8B00FF', '#FFD700', '#FF4500', '#00FF88', '#FF69B4'];

  // Permission bit labels for display
  const permissionLabels: Record<string, string> = Object.fromEntries(
    PERMISSION_BITS.map((p) => [p.bit.toString(), p.label])
  );

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
            {t('server.serverSettings')}
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
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold text-rally-text">
            {t(TABS.find((tab) => tab.id === activeTab)?.labelKey ?? '')}
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
                {t('server.serverIcon')}
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
                    {t('server.clickUpload')}
                  </p>
                  {serverIconPreview && serverIconPreview !== activeServer?.iconUrl && (
                    <button
                      onClick={() => setServerIconPreview(activeServer?.iconUrl || null)}
                      className="text-xs text-rally-magenta hover:underline mt-1"
                    >
                      {t('server.reset')}
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
                {t('server.serverName')} <span className="text-rally-magenta">*</span>
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
                {t('server.description')}
              </label>
              <textarea
                value={serverDescription}
                onChange={(e) => setServerDescription(e.target.value)}
                className="input-rally rounded h-24 resize-none w-full"
                placeholder={t('server.descriptionPlaceholder')}
                maxLength={1024}
                disabled={!isOwner}
              />
            </div>

            {/* Visibility toggle */}
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-2">
                {t('server.visibility')}
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
                  {t('server.private')}
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
                  {t('server.public')}
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
                  {isSaving ? t('common.saving') : t('common.save')}
                </button>
                {saveSuccess && (
                  <span className="text-sm text-rally-green flex items-center gap-1">
                    <Check className="w-4 h-4" /> {t('common.saved')}
                  </span>
                )}
              </div>
            )}

            {!isOwner && (
              <p className="text-xs text-rally-text-muted italic">
                {t('server.ownerOnly')}
              </p>
            )}
          </div>
        )}

        {/* === RANKS TAB === */}
        {activeTab === 'ranks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-rally-text-muted">
                {t('server.ranksDesc')}
              </p>
              {isOwner && !showRoleForm && (
                <button
                  onClick={() => openRoleForm()}
                  className="btn-rally-primary px-4 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('server.createRank')}
                </button>
              )}
            </div>

            {/* Role Form (Create / Edit) */}
            {showRoleForm && (
              <div className="card-rally rounded-lg p-5 border border-rally-blue/30 space-y-4">
                <h3 className="font-display font-semibold text-rally-text">
                  {editingRole ? t('server.editRank') : t('server.createRank')}
                </h3>

                {/* Name */}
                <div>
                  <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">
                    {t('server.rankName')}
                  </label>
                  <input
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="input-rally rounded w-full"
                    placeholder="e.g. Moderator"
                    maxLength={50}
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-2">
                    {t('server.rankColor')}
                  </label>
                  <div className="flex items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setRoleColor(c)}
                        className={cn(
                          'w-7 h-7 rounded-full transition-all',
                          roleColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-110' : 'hover:scale-110'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={roleColor}
                      onChange={(e) => setRoleColor(e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border border-white/20"
                    />
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-2">
                    {t('server.permissions')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {PERMISSION_BITS.map((p) => (
                      <label
                        key={p.key}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-xs transition-colors',
                          (rolePerms & p.bit) ? 'bg-rally-blue/10 text-rally-blue' : 'bg-white/[0.03] text-rally-text-muted hover:bg-white/[0.06]'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!!(rolePerms & p.bit)}
                          onChange={() => togglePerm(p.bit)}
                          className="sr-only"
                        />
                        <div className={cn(
                          'w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0',
                          (rolePerms & p.bit) ? 'border-rally-blue bg-rally-blue' : 'border-white/20'
                        )}>
                          {!!(rolePerms & p.bit) && <Check className="w-2.5 h-2.5 text-black" />}
                        </div>
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveRole}
                    disabled={isSavingRole || !roleName.trim()}
                    className="btn-rally-primary px-5 py-2 text-sm"
                  >
                    {isSavingRole ? t('common.saving') : (editingRole ? t('common.save') : t('common.create'))}
                  </button>
                  <button
                    onClick={() => setShowRoleForm(false)}
                    className="px-5 py-2 text-sm text-rally-text-muted hover:text-rally-text transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {/* Role List */}
            {roles.length > 0 ? (
              <div className="space-y-2">
                {[...roles]
                  .sort((a, b) => b.position - a.position)
                  .map((role: Role) => (
                    <div
                      key={role.id}
                      className="card-rally rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors group"
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
                            {t('server.default')}
                          </span>
                        )}
                        <span className="text-[10px] text-rally-text-muted ml-auto">
                          {t('server.position')} {role.position}
                        </span>
                        {isOwner && !role.isDefault && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openRoleForm(role)}
                              className="p-1 rounded text-white/40 hover:text-rally-blue hover:bg-rally-blue/10 transition-colors"
                              title={t('common.edit')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete({ roleId: role.id, roleName: role.name })}
                              className="p-1 rounded text-white/40 hover:text-rally-magenta hover:bg-rally-magenta/10 transition-colors"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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
                <p className="text-white/30 text-sm">{t('server.noRanks')}</p>
              </div>
            )}
          </div>
        )}

        {/* === MEMBERS TAB === */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-rally-text-muted">
                {t('server.membersCount', { count: members.length })}
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
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {memberRoles.map((role: Role) => (
                        <span
                          key={role.id}
                          className="text-[10px] px-2 py-0.5 rounded-full font-display inline-flex items-center gap-1 group/role"
                          style={{
                            backgroundColor: `${role.color || '#8B949E'}20`,
                            color: role.color || '#8B949E',
                            border: `1px solid ${role.color || '#8B949E'}40`,
                          }}
                        >
                          {role.name}
                          {isOwner && !role.isDefault && (
                            <button
                              onClick={() => handleRemoveRole(member.id, role.id)}
                              className="opacity-0 group-hover/role:opacity-100 hover:text-rally-magenta transition-all"
                              disabled={roleActionLoading === role.id}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      ))}
                      {isOwner && (
                        <div className="relative">
                          <button
                            onClick={() => setAssignDropdownMember(assignDropdownMember === member.id ? null : member.id)}
                            className="w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          {assignDropdownMember === member.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setAssignDropdownMember(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-white/10 bg-[#1A1F36] py-1 shadow-elevation-3">
                                <p className="px-3 py-1 text-[10px] font-display font-semibold uppercase tracking-wider text-white/30">
                                  {t('server.assignRank')}
                                </p>
                                {roles
                                  .filter((r) => !r.isDefault && !memberRoles.some((mr) => mr.id === r.id))
                                  .map((role) => (
                                    <button
                                      key={role.id}
                                      onClick={() => handleAssignRole(member.id, role.id)}
                                      disabled={roleActionLoading === role.id}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-white/70 hover:bg-white/10 transition-colors"
                                    >
                                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: role.color || '#8B949E' }} />
                                      <span>{role.name}</span>
                                    </button>
                                  ))}
                                {roles.filter((r) => !r.isDefault && !memberRoles.some((mr) => mr.id === r.id)).length === 0 && (
                                  <p className="px-3 py-2 text-[10px] text-white/30">{t('server.noAvailableRanks')}</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {members.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">{t('server.noMembers')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === INVITES TAB === */}
        {activeTab === 'invites' && (
          <div className="space-y-6">
            <p className="text-sm text-rally-text-muted">
              {t('server.generateInvite')}
            </p>

            {/* Create invite */}
            <div className="card-rally rounded-lg p-5 border border-white/5">
              <h3 className="font-display font-semibold text-rally-text mb-3">
                {t('server.createNewInvite')}
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
                      {t('server.generating')}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {t('server.generateInviteCode')}
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
                    <p className="text-xs text-rally-green">{t('common.copied')}</p>
                  )}
                  <button
                    onClick={() => {
                      setInviteCode(null);
                      setCopied(false);
                    }}
                    className="text-xs text-rally-text-muted hover:text-rally-text transition-colors"
                  >
                    {t('server.generateAnother')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Role Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Role"
        message={`Are you sure you want to delete "${confirmDelete?.roleName}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (confirmDelete) handleDeleteRole(confirmDelete.roleId);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
