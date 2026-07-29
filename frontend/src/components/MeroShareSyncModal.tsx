import React, { useState, useEffect } from 'react';
import { meroshareApi, type DPOption, type MeroShareCredentials } from '../services/api';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MeroShareSyncModal: React.FC<ModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [capitals, setCapitals] = useState<DPOption[]>([]);
  const [form, setForm] = useState<MeroShareCredentials>({ dp_id: '', username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      meroshareApi.getCapitals()
        .then((data) => setCapitals(data))
        .catch(() => setError('Could not load DP list. Please try again.'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await meroshareApi.syncPortfolio(form);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to sync MeroShare holdings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md text-white shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Sync from MeroShare</h2>
        
        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Depository Participant (DP)</label>
            <select
              required
              value={form.dp_id}
              onChange={(e) => setForm({ ...form, dp_id: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">Select your DP/Capital</option>
              {capitals.map((dp) => (
                <option key={dp.id} value={dp.id}>
                  {dp.name} ({dp.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">MeroShare Username</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-cyan-500"
              placeholder="Username"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-cyan-500"
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Syncing...' : 'Sync Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};