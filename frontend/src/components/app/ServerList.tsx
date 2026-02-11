import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Compass, MessageCircle } from 'lucide-react';
import { cn, getInitials, generateColor } from '@/lib/utils';
import { useServerStore } from '@/stores/serverStore';
import Tooltip from '@/components/ui/Tooltip';
import Modal from '@/components/ui/Modal';

export default function ServerList() {
  const { servers, activeServerId, setActiveServer, createServer } = useServerStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleHomeClick = () => {
    setActiveServer(null);
    navigate('/channels/@me');
  };

  const handleServerClick = (serverId: string) => {
    setActiveServer(serverId);
    const server = servers.find((s) => s.id === serverId);
    const firstChannel = server?.channels.find(
      (c) => c.type === 'text' || c.type === 'TEXT'
    );
    if (firstChannel) {
      navigate(`/channels/${serverId}/${firstChannel.id}`);
    } else {
      navigate(`/channels/${serverId}`);
    }
  };

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    setCreating(true);
    try {
      const server = await createServer(newServerName.trim());
      setShowCreate(false);
      setNewServerName('');
      handleServerClick(server.id);
    } catch {
      // error handled by store
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="w-[72px] bg-rally-darkBg flex flex-col items-center py-3 gap-2 overflow-y-auto no-scrollbar flex-shrink-0">
        {/* Home / DMs button */}
        <Tooltip content="Direct Messages" position="right">
          <button
            onClick={handleHomeClick}
            className={cn(
              'server-icon bg-rally-darkerBg text-rally-cyan hover:bg-rally-purple hover:text-white',
              !activeServerId && 'bg-rally-purple text-white rounded-xl'
            )}
          >
            <MessageCircle size={24} />
          </button>
        </Tooltip>

        <div className="w-8 h-0.5 bg-rally-darkerBg rounded-full my-1" />

        {/* Server icons */}
        {servers.map((server) => (
          <Tooltip key={server.id} content={server.name} position="right">
            <div className="relative">
              {/* Active indicator pill */}
              {activeServerId === server.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[22px] w-1 h-10 bg-white rounded-r-full" />
              )}
              <button
                onClick={() => handleServerClick(server.id)}
                className={cn(
                  'server-icon',
                  activeServerId === server.id && 'rounded-xl'
                )}
              >
                {server.icon ? (
                  <img
                    src={server.icon}
                    alt={server.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: generateColor(server.id) }}
                  >
                    {getInitials(server.name)}
                  </div>
                )}
              </button>
            </div>
          </Tooltip>
        ))}

        <div className="w-8 h-0.5 bg-rally-darkerBg rounded-full my-1" />

        {/* Add server */}
        <Tooltip content="Add a Server" position="right">
          <button
            onClick={() => setShowCreate(true)}
            className="server-icon bg-rally-darkerBg text-rally-green hover:bg-rally-green hover:text-white"
          >
            <Plus size={24} />
          </button>
        </Tooltip>

        {/* Discover (placeholder) */}
        <Tooltip content="Explore Public Servers" position="right">
          <button className="server-icon bg-rally-darkerBg text-rally-green hover:bg-rally-green hover:text-white">
            <Compass size={24} />
          </button>
        </Tooltip>
      </div>

      {/* Create Server Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create a Server"
        description="Give your new server a personality with a name. You can always change it later."
      >
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-xs font-bold text-rally-muted uppercase tracking-wide mb-2">
              Server Name
            </label>
            <input
              type="text"
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateServer()}
              className="rally-input"
              placeholder="My Awesome Server"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="rally-btn-ghost"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateServer}
              disabled={creating || !newServerName.trim()}
              className="rally-btn-primary"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
