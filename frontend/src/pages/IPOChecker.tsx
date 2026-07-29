// frontend/src/pages/IPOChecker.tsx
import toast from 'react-hot-toast';
import { useState, useEffect, type FormEvent } from 'react';
import { 
  Building2, Plus, Trash2, CheckCircle2, 
  Users, Copy, ExternalLink, ShieldAlert
} from 'lucide-react';
import api from '../services/api';

interface BOIDEntry {
  id: string;
  name: string;
  boid: string;
}

const LOCAL_STORAGE_KEY = 'share_sathi_family_boids';

export default function IPOChecker() {
  const [boidList, setBoidList] = useState<BOIDEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [newBoid, setNewBoid] = useState('');
  const [isAddingBoid, setIsAddingBoid] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 1. Fetch user's profile BOID + load saved family BOIDs from local storage
  useEffect(() => {
    const initData = async () => {
      let stored: BOIDEntry[] = [];
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          stored = JSON.parse(saved);
        }
      } catch (e) {
        console.error('Failed to parse saved family BOIDs', e);
      }

      // Fetch logged-in user's profile to auto-include their primary BOID
      try {
        const userRes = await api.get('/auth/me');
        if (userRes.data.boid) {
          const userBoid = userRes.data.boid;
          const exists = stored.some((item) => item.boid === userBoid);
          if (!exists) {
            stored.unshift({
              id: 'primary-user-boid',
              name: 'My Account (Self)',
              boid: userBoid,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load user profile for BOID', error);
      }

      setBoidList(stored);
    };

    initData();
  }, []);

  // Save BOID list to local storage whenever modified
  const saveBoids = (updated: BOIDEntry[]) => {
    setBoidList(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  };

  // Add new family BOID
  const handleAddBoid = (e: FormEvent) => {
    e.preventDefault();
    const cleanBoid = newBoid.replace(/\D/g, '');

    if (cleanBoid.length !== 16) {
      toast.error('BOID must be exactly 16 digits.');
      return;
    }

    if (boidList.some((item) => item.boid === cleanBoid)) {
      toast.error('This BOID is already in your list.');
      return;
    }

    const updated = [
      ...boidList,
      {
        id: Date.now().toString(),
        name: newName.trim() || `BOID ${boidList.length + 1}`,
        boid: cleanBoid,
      },
    ];

    saveBoids(updated);
    setNewName('');
    setNewBoid('');
    setIsAddingBoid(false);
    toast.success('BOID added to family list!');
  };

  // Remove BOID
  const handleRemoveBoid = (id: string) => {
    const updated = boidList.filter((item) => item.id !== id);
    saveBoids(updated);
    toast.success('BOID removed.');
  };

  // Copy BOID to clipboard
  const handleCopy = (boid: string, id: string) => {
    navigator.clipboard.writeText(boid);
    setCopiedId(id);
    toast.success('BOID Copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen px-4 py-8 bg-gray-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center text-3xl font-bold text-gray-900">
              <Building2 className="w-8 h-8 mr-3 text-blue-600" />
              Family BOID Wallet
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your family's Demat numbers for rapid IPO result checking.
            </p>
          </div>
        </div>

        {/* Notice Card */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 leading-relaxed">
            <strong>CDSC Security Update:</strong> CDSC has blocked all automated third-party bulk checkers and introduced CAPTCHAs. Keep your family's BOIDs saved here, copy them in one click, and paste them directly into the official portal below.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* Left Column: Official Portal Link */}
          <div className="space-y-6 lg:col-span-1">
            <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
              <h2 className="mb-4 text-lg font-bold text-gray-900">Official CDSC Portal</h2>
              <p className="text-sm text-gray-500 mb-6">
                Use your copied BOIDs to check the results directly on the official server.
              </p>
              <a
                href="https://iporesult.cdsc.com.np"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full py-3.5 text-sm font-bold text-white transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md"
              >
                Open iporesult.cdsc.com.np
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </div>
          </div>

          {/* Right Column: Family BOID Manager */}
          <div className="space-y-6 lg:col-span-2">
            <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Saved Accounts ({boidList.length})
                  </h2>
                </div>
                <button
                  onClick={() => setIsAddingBoid(!isAddingBoid)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                >
                  <Plus className="w-4 h-4" />
                  Add Account
                </button>
              </div>

              {/* Add Account Form */}
              {isAddingBoid && (
                <form onSubmit={handleAddBoid} className="p-4 mb-6 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Add New BOID</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Label / Name (e.g., Mom, Dad)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                    />
                    <input
                      type="text"
                      required
                      maxLength={16}
                      placeholder="16-Digit BOID (e.g. 130123...)"
                      value={newBoid}
                      onChange={(e) => setNewBoid(e.target.value.replace(/\D/g, ''))}
                      className="px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingBoid(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      Save Account
                    </button>
                  </div>
                </form>
              )}

              {/* BOID List */}
              {boidList.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <p>No family accounts added yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {boidList.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 border border-gray-200 bg-gray-50/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-200 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{entry.name}</h4>
                        <p className="font-mono text-xs text-gray-500 tracking-wider">{entry.boid}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(entry.boid, entry.id)}
                          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                            copiedId === entry.id
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {copiedId === entry.id ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedId === entry.id ? 'Copied' : 'Copy'}
                        </button>

                        {entry.id !== 'primary-user-boid' && (
                          <button
                            onClick={() => handleRemoveBoid(entry.id)}
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Remove BOID"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}