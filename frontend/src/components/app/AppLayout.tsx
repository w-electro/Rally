import { useEffect } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { useServerStore } from '@/stores/serverStore';
import ServerList from './ServerList';
import ChannelSidebar from './ChannelSidebar';
import DmSidebar from './DmSidebar';
import ChatArea from './ChatArea';
import MemberList from './MemberList';
import FriendsView from './FriendsView';

export default function AppLayout() {
  const { fetchServers } = useServerStore();

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return (
    <div className="app-layout flex bg-rally-darkBg">
      <ServerList />
      <Routes>
        <Route path="@me/*" element={<DmLayout />} />
        <Route path=":serverId/*" element={<ServerLayout />} />
        <Route path="*" element={<DmLayout />} />
      </Routes>
    </div>
  );
}

function DmLayout() {
  return (
    <>
      <DmSidebar />
      <FriendsView />
    </>
  );
}

function ServerLayout() {
  const { serverId } = useParams();
  const { setActiveServer, setActiveChannel, servers } = useServerStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (serverId && servers.length > 0) {
      const server = servers.find((s) => s.id === serverId);
      if (server) {
        setActiveServer(serverId);
      }
    }
  }, [serverId, servers, setActiveServer]);

  return (
    <Routes>
      <Route
        path=":channelId"
        element={<ServerChannelView />}
      />
      <Route
        path="*"
        element={
          <>
            <ChannelSidebar />
            <ChatArea />
            <MemberList />
          </>
        }
      />
    </Routes>
  );
}

function ServerChannelView() {
  const { channelId } = useParams();
  const { setActiveChannel } = useServerStore();

  useEffect(() => {
    if (channelId) {
      setActiveChannel(channelId);
    }
  }, [channelId, setActiveChannel]);

  return (
    <>
      <ChannelSidebar />
      <ChatArea />
      <MemberList />
    </>
  );
}
