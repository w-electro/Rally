import { useState, useEffect } from 'react';
import { useServerStore } from '@/stores/serverStore';
import api from '@/lib/api';
import type { GameSession } from '@/lib/types';
import { Gamepad2, Plus, Calendar, Users, Clock, Megaphone, Check, X } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Modal } from '../ui/Modal';

export function GameSessionPanel() {
  const { activeServer } = useServerStore();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ title: '', game: '', description: '', scheduledAt: '', maxPlayers: '' });

  useEffect(() => {
    if (!activeServer) return;
    setIsLoading(true);
    api.getGameSessions(activeServer.id)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activeServer?.id]);

  const handleCreate = async () => {
    if (!activeServer || !form.title || !form.game || !form.scheduledAt) return;
    try {
      const session = await api.createGameSession({
        serverId: activeServer.id,
        title: form.title,
        game: form.game,
        description: form.description,
        scheduledAt: form.scheduledAt,
        maxPlayers: form.maxPlayers ? parseInt(form.maxPlayers) : undefined,
      });
      setSessions([session, ...sessions]);
      setShowCreate(false);
      setForm({ title: '', game: '', description: '', scheduledAt: '', maxPlayers: '' });
    } catch {}
  };

  const handleRally = async () => {
    if (!activeServer) return;
    try {
      await api.rallyCall(activeServer.id, 'Rally up! Time to game!');
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col bg-black min-h-0">
      <div className="px-4 py-3 border-b border-rally-border bg-[#0D1117]/80 flex items-center gap-3">
        <Gamepad2 className="w-5 h-5 text-rally-cyan" />
        <h2 className="font-display font-bold text-rally-text">Gaming Sessions</h2>
        <div className="flex-1" />
        <button onClick={handleRally} className="btn-rally-primary text-xs flex items-center gap-1 mr-2">
          <Megaphone className="w-3.5 h-3.5" />Rally!
        </button>
        <button onClick={() => setShowCreate(true)} className="btn-rally text-xs flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />New Session
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-12"><div className="w-6 h-6 border-2 border-rally-cyan border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <Gamepad2 className="w-12 h-12 text-rally-text-muted mx-auto mb-3" />
            <p className="text-rally-text-muted">No upcoming sessions. Create one!</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="card-rally rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-bold text-rally-text">{session.title}</h3>
                  <p className="text-sm text-rally-cyan font-medium">{session.game}</p>
                </div>
                <span className="badge-rally text-[10px]">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {formatDate(session.scheduledAt)}
                </span>
              </div>
              {session.description && (
                <p className="text-xs text-rally-text-muted mt-2">{session.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <span className="text-xs text-rally-text-muted flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {session.members?.length || 0}{session.maxPlayers ? `/${session.maxPlayers}` : ''} players
                </span>
                <div className="flex-1" />
                <button className="text-xs px-3 py-1 rounded bg-rally-green/10 text-rally-green border border-rally-green/30 hover:bg-rally-green/20 transition-colors">
                  <Check className="w-3 h-3 inline mr-1" />Join
                </button>
              </div>
              {session.members && session.members.length > 0 && (
                <div className="flex -space-x-2 mt-2">
                  {session.members.slice(0, 5).map((m) => (
                    <div key={m.id} className="w-6 h-6 rounded-full bg-gradient-to-br from-rally-blue to-rally-green border-2 border-[#0D1117] flex items-center justify-center text-[8px] font-bold text-black">
                      {m.user?.displayName?.[0] || '?'}
                    </div>
                  ))}
                  {session.members.length > 5 && (
                    <div className="w-6 h-6 rounded-full bg-rally-navy border-2 border-[#0D1117] flex items-center justify-center text-[8px] text-rally-text-muted">+{session.members.length - 5}</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Session Modal */}
      {showCreate && (
        <Modal isOpen onClose={() => setShowCreate(false)} title="Create Game Session" size="md">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Game</label>
              <input value={form.game} onChange={(e) => setForm({ ...form, game: e.target.value })} className="input-rally rounded" placeholder="e.g. Valorant, Apex Legends" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Session Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-rally rounded" placeholder="e.g. Ranked grind tonight" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">When</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="input-rally rounded" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Max Players (optional)</label>
              <input type="number" value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: e.target.value })} className="input-rally rounded" placeholder="Leave empty for unlimited" />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-rally-text-muted mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-rally rounded h-20 resize-none" placeholder="Details about the session..." />
            </div>
            <button onClick={handleCreate} className="btn-rally-primary w-full py-2.5">Create Session</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
