import React, { useState, useEffect } from 'react';
import api, { meroshareApi, type DPOption, type MeroShareCredentials } from '../services/api';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MeroShareSyncModal: React.FC<ModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [capitals, setCapitals] = useState<DPOption[]>([]);
  const [form, setForm] = useState<MeroShareCredentials>({ dp_id: '', username: '', password: '' });
  const [hasSavedCreds, setHasSavedCreds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch DP Capitals
      meroshareApi.getCapitals()
        .then((data) => setCapitals(data))
        .catch(() => setError('Could not load DP list. Please try again.'));

      // Check with backend if credentials are already securely saved
      api.get('/meroshare/status').then((res) => {
        if (res.data.has_saved_credentials) {
          setHasSavedCreds(true);
          setForm({ ...form, dp_id: res.data.dp_id, username: res.data.username });
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handles syncing when credentials are NOT saved yet
  const handleSaveAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/meroshare/save-and-sync', form);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to sync MeroShare holdings.');
    } finally {
      setLoading(false);
    }
  };

  // Handles syncing when credentials ARE saved securely on the backend
  const handleSyncSaved = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/meroshare/sync-saved');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to sync with saved credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    setLoading(true);
    try {
      await api.delete('/meroshare/clear');
      setHasSavedCreds(false);
      setForm({ dp_id: '', username: '', password: '' });
    } catch (err) {
      setError('Failed to clear credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md text-white shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Sync from MeroShare</h2>
        
        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}

        {hasSavedCreds ? (
          <div className="space-y-6">
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-300 mb-2">Saved Account:</p>
              <p className="font-medium text-cyan-400">{form.username}</p>
              <p className="text-xs text-slate-500 mt-1">Your password is securely encrypted on our servers.</p>
            </div>
            
            <div className="flex justify-between items-center">
              <button onClick={handleClearData} disabled={loading} className="text-xs text-rose-400 hover:text-rose-300">
                Clear Credentials
              </button>
              <div className="flex space-x-3">
                <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                <button onClick={handleSyncSaved} disabled={loading} className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium disabled:opacity-50">
                  {loading ? 'Syncing...' : '1-Click Sync'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveAndSync} className="space-y-4">
            {/* Same form fields as before for DP, Username, and Password */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Depository Participant (DP)</label>
              <select required value={form.dp_id} onChange={(e) => setForm({ ...form, dp_id: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-cyan-500">
                <option value="">Select your DP/Capital</option>
                {capitals.map((dp) => <option key={dp.id} value={dp.id}>{dp.name} ({dp.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Username</label>
              <input type="text" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-cyan-500" />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={loading} className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium disabled:opacity-50">
                {loading ? 'Syncing...' : 'Save & Sync Portfolio'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};