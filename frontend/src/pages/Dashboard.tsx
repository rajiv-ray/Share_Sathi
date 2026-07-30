import toast from 'react-hot-toast';
import { useState, useEffect, type FormEvent } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  AlertTriangle, CheckCircle2, Plus, 
  Wallet, Activity, Loader2, X, Zap, Edit2, TrendingUp, LineChart 
} from 'lucide-react';
import api, { portfolioApi } from '../services/api';
import { MeroShareSyncModal } from '../components/MeroShareSyncModal';

// --- TypeScript Interfaces ---
interface SectorAllocation {
  sector: string;
  percentage: number;
  total_value: number;
}

interface PortfolioHealth {
  health_score: number;
  total_invested: number;
  current_value: number;
  total_profit: number;
  profit_percentage: number;
  allocations: SectorAllocation[];
  warnings: string[];
  recommendations: string[];
}

interface Transaction {
  id: number;
  stock_symbol: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  transaction_date: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function Dashboard() {
  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Trade Form State
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Edit Price State
  const [editPrice, setEditPrice] = useState('');

  const fetchDashboardData = async () => {
    try {
      const [healthRes, txRes] = await Promise.all([
        api.get('/portfolio/health'),
        api.get('/portfolio/')
      ]);
      setHealth(healthRes.data);
      setTransactions(txRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleAddTrade = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = toast.loading('Logging transaction...');

    try {
      await api.post('/portfolio/', {
        stock_symbol: symbol,
        transaction_type: type,
        quantity: parseInt(quantity),
        price: parseFloat(price),
        transaction_date: date
      });
      
      setIsModalOpen(false);
      setSymbol(''); setQuantity(''); setPrice('');
      fetchDashboardData();
      toast.success('Trade logged successfully!', { id: toastId });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to add transaction.';
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPrice = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    setIsSubmitting(true);
    const toastId = toast.loading('Updating WACC/Price...');

    try {
      await portfolioApi.updateTransactionPrice(editingTx.id, { price: parseFloat(editPrice) });
      setEditingTx(null);
      setEditPrice('');
      fetchDashboardData();
      toast.success('Price updated successfully!', { id: toastId });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to update price.';
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditPrice(tx.price.toString());
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="mt-4 text-gray-500 animate-pulse">Calculating Portfolio Metrics...</p>
      </div>
    );
  }

  const scoreColor = 
    (health?.health_score || 0) >= 80 ? 'text-emerald-500' : 
    (health?.health_score || 0) >= 50 ? 'text-amber-500' : 'text-red-500';

  const profitColor = (health?.total_profit || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500';

  return (
    <div className="min-h-screen px-4 py-8 bg-gray-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        {/* Header */}
        <div className="flex flex-col items-start justify-between mb-8 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Real-time diversification & health analysis</p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm"
            >
              <Zap className="w-4 h-4" />
              Sync MeroShare
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Trade
            </button>
          </div>
        </div>

        {/* Top KPIs - Now a 4-Column Grid */}
        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2 xl:grid-cols-4">
          
          {/* Total Invested Card */}
          <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
            <div className="flex items-center mb-4 text-gray-500">
              <Wallet className="w-5 h-5 mr-2 text-blue-500" />
              <h2 className="font-semibold text-sm">Last Traded Price</h2>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              Rs. {health?.total_invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Current Value Card */}
          <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
            <div className="flex items-center mb-4 text-gray-500">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-500" />
              <h2 className="font-semibold text-sm">Current Value</h2>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              Rs. {health?.current_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          {/* Profit / Loss Card */}
          <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
            <div className="flex items-center mb-4 text-gray-500">
              <LineChart className="w-5 h-5 mr-2 text-gray-500" />
              <h2 className="font-semibold text-sm">Overall P/L</h2>
            </div>
            <div className="flex items-end gap-2">
              <p className={`text-2xl font-bold ${profitColor}`}>
                {(health?.total_profit || 0) >= 0 ? '+' : ''}Rs. {health?.total_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className={`text-sm font-semibold mb-1 ${profitColor}`}>
                ({(health?.profit_percentage || 0) >= 0 ? '+' : ''}{health?.profit_percentage.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Health Score Card */}
          <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2 text-gray-500">
              <div className="flex items-center">
                <Activity className={`w-5 h-5 mr-2 ${scoreColor}`} />
                <h2 className="font-semibold text-sm">Health Score</h2>
              </div>
            </div>
            <span className={`text-2xl font-bold ${scoreColor}`}>
              {health?.health_score} / 100
            </span>
            <div className="w-full h-2 mt-3 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${
                  (health?.health_score || 0) >= 80 ? 'bg-emerald-500' : 
                  (health?.health_score || 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${health?.health_score || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
          
          {/* Sector Allocation Donut Chart */}
          <div className="p-6 bg-white border border-gray-100 shadow-sm lg:col-span-2 rounded-2xl">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">Sector Allocation</h2>
            {health?.allocations.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                No active investments found.
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={health?.allocations}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="percentage"
                      nameKey="sector"
                    >
                      {health?.allocations.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`${value}%`, 'Allocation']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* AI Insights & Warnings */}
          <div className="flex flex-col gap-6">
            <div className="flex-1 p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
              <h2 className="flex items-center mb-4 text-lg font-semibold text-gray-900">
                <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-500" />
                Recommendations
              </h2>
              <ul className="space-y-3">
                {health?.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start">
                    <span className="mr-2 text-emerald-500">•</span> {rec}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex-1 p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
              <h2 className="flex items-center mb-4 text-lg font-semibold text-gray-900">
                <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
                Risk Warnings
              </h2>
              {health?.warnings.length === 0 ? (
                <p className="text-sm text-gray-500">No active risk warnings.</p>
              ) : (
                <ul className="space-y-3">
                  {health?.warnings.map((warn, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start">
                      <span className="mr-2 text-amber-500">⚠</span> {warn}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Transaction Ledger */}
        <div className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-2xl">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-400 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Quantity</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-right">Total Value</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-400">No transactions recorded yet.</td>
                  </tr>
                ) : (
                  transactions.slice().reverse().map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{tx.transaction_date}</td>
                      <td className="px-6 py-4 font-bold text-gray-900">{tx.stock_symbol}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                          tx.transaction_type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">{tx.quantity}</td>
                      <td className="px-6 py-4 text-right">Rs. {tx.price.toFixed(2)}</td>
                      <td className="px-6 py-4 font-medium text-right text-gray-900">
                        Rs. {(tx.quantity * tx.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => openEditModal(tx)}
                          className="p-1 text-gray-400 transition-colors rounded hover:text-blue-600 hover:bg-blue-50"
                          title="Edit Purchase Price (WACC)"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* --- MeroShare Sync Modal --- */}
      <MeroShareSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSuccess={() => {
          toast.success('Portfolio synced with MeroShare!');
          fetchDashboardData();
        }}
      />

      {/* --- EDIT PRICE / WACC MODAL --- */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-gray-900">Edit WACC / Price</h3>
              <button onClick={() => setEditingTx(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Update the purchase price for <strong>{editingTx.quantity}</strong> shares of <strong>{editingTx.stock_symbol}</strong>.
            </p>
            <form onSubmit={handleEditPrice} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Cost per Share (Rs.)</label>
                <input 
                  type="number" required min="0.01" step="0.01" 
                  value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="flex items-center justify-center w-full px-4 py-2.5 mt-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Price'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD TRADE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-gray-900">Log Transaction</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Type</label>
                  <select 
                    value={type} 
                    onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')}
                    className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Stock Symbol</label>
                  <input 
                    type="text" required placeholder="e.g. NABIL" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Quantity</label>
                  <input 
                    type="number" required min="1" placeholder="Shares" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                    className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Price per Share</label>
                  <input 
                    type="number" required min="0.01" step="0.01" placeholder="Rs." value={price} onChange={(e) => setPrice(e.target.value)}
                    className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Transaction Date</label>
                <input 
                  type="date" required max={new Date().toISOString().split('T')[0]} value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full py-2.5 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <button 
                type="submit" disabled={isSubmitting}
                className="flex items-center justify-center w-full px-4 py-2.5 mt-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Trade'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}