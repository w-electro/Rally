import { useState, useEffect } from 'react';
import { useServerStore } from '@/stores/serverStore';
import api from '@/lib/api';
import type { PointBalance, PointReward } from '@/lib/types';
import { Coins, Gift, Trophy, History, Sparkles } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { Tabs } from '../ui/Tabs';

export function PointsPanel() {
  const { activeServer } = useServerStore();
  const [balance, setBalance] = useState<PointBalance | null>(null);
  const [rewards, setRewards] = useState<PointReward[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('rewards');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeServer) return;
    setIsLoading(true);

    Promise.all([
      api.getPointBalance(activeServer.id).catch(() => null),
      api.getRewards(activeServer.id).catch(() => []),
      api.getLeaderboard(activeServer.id).catch(() => []),
    ]).then(([bal, rew, lb]) => {
      setBalance(bal);
      setRewards(rew);
      setLeaderboard(lb);
      setIsLoading(false);
    });
  }, [activeServer?.id]);

  const handleRedeem = async (rewardId: string) => {
    if (!activeServer) return;
    try {
      await api.redeemReward(activeServer.id, rewardId);
      const reward = rewards.find((r) => r.id === rewardId);
      if (reward && balance) {
        setBalance({ ...balance, balance: balance.balance - reward.cost });
      }
    } catch {}
  };

  return (
    <div className="w-72 bg-[#0D1117] border-l border-rally-border flex flex-col h-full">
      {/* Balance */}
      <div className="p-4 border-b border-rally-border text-center">
        <Coins className="w-8 h-8 text-rally-green mx-auto mb-1" />
        <p className="text-3xl font-display font-bold neon-text-green">{balance ? formatNumber(balance.balance) : '...'}</p>
        <p className="text-xs text-rally-text-muted">Channel Points</p>
        {balance && (
          <p className="text-[10px] text-rally-text-muted mt-1">Total earned: {formatNumber(balance.totalEarned)}</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'rewards', label: 'Rewards' },
          { id: 'leaderboard', label: 'Top 10' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="text-center py-8"><div className="w-5 h-5 border-2 border-rally-green border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : activeTab === 'rewards' ? (
          rewards.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="w-8 h-8 text-rally-text-muted mx-auto mb-2" />
              <p className="text-xs text-rally-text-muted">No rewards available</p>
            </div>
          ) : (
            rewards.filter((r) => r.isEnabled).map((reward) => (
              <div key={reward.id} className="card-rally rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded bg-rally-green/10 flex items-center justify-center flex-shrink-0">
                    {reward.iconUrl ? (
                      <img src={reward.iconUrl} alt="" className="w-5 h-5" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-rally-green" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-rally-text">{reward.title}</h4>
                    {reward.description && (
                      <p className="text-[10px] text-rally-text-muted mt-0.5">{reward.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRedeem(reward.id)}
                  disabled={!balance || balance.balance < reward.cost}
                  className={cn(
                    'w-full mt-2 py-1.5 rounded text-xs font-display font-semibold transition-colors',
                    balance && balance.balance >= reward.cost
                      ? 'bg-rally-green/10 text-rally-green border border-rally-green/30 hover:bg-rally-green/20'
                      : 'bg-white/5 text-rally-text-muted cursor-not-allowed'
                  )}
                >
                  <Coins className="w-3 h-3 inline mr-1" />{formatNumber(reward.cost)}
                </button>
              </div>
            ))
          )
        ) : (
          leaderboard.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-8 h-8 text-rally-text-muted mx-auto mb-2" />
              <p className="text-xs text-rally-text-muted">No leaderboard data</p>
            </div>
          ) : (
            leaderboard.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-2 rounded hover:bg-white/5">
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  i === 0 ? 'bg-yellow-400 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-orange-600 text-white' : 'bg-white/10 text-rally-text-muted'
                )}>{i + 1}</span>
                <span className="text-sm text-rally-text flex-1 truncate">{entry.username || entry.userId}</span>
                <span className="text-xs text-rally-green font-mono">{formatNumber(entry.balance || 0)}</span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
