// frontend/src/pages/AnalyticsLab.tsx
import toast from 'react-hot-toast';
import { useState, type FormEvent } from 'react';
import { 
  TrendingUp, TrendingDown, BrainCircuit, Loader2, 
  Search, ShieldAlert 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import api from '../services/api';

interface StockForecastResponse {
  symbol: string;
  prediction: 'UP' | 'DOWN' | 'UNKNOWN';
  confidence: string;
  advice: string;
  current_price: number; // Updated: Receives current live price from NEPSE fetcher
  historical_data: { date: string; close: number }[];
}

export default function StockForecaster() {
  const [searchSymbol, setSearchSymbol] = useState('');
  const [isAnalyzingStock, setIsAnalyzingStock] = useState(false);
  const [stockResult, setStockResult] = useState<StockForecastResponse | null>(null);

  const handleStockSearch = async (symbolToSearch?: string) => {
    const symbol = (symbolToSearch || searchSymbol).toUpperCase().trim();
    if (!symbol) return;

    setStockResult(null);
    setIsAnalyzingStock(true);
    const toastId = toast.loading(`Loading ML data for ${symbol}...`);

    try {
      const response = await api.get(`/analytics/analyze-stock/${symbol}`);
      setStockResult(response.data);
      toast.success(`Analysis generated for ${symbol}`, { id: toastId });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to analyze stock data.';
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsAnalyzingStock(false);
    }
  };

  const handleFormStockSearch = (e: FormEvent) => {
    e.preventDefault();
    handleStockSearch();
  };

  return (
    <div className="min-h-screen px-4 py-8 bg-gray-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Page Header */}
        <div>
          <h1 className="flex items-center text-3xl font-bold text-gray-900">
            <BrainCircuit className="w-8 h-8 mr-3 text-emerald-600" />
            ML Stock Forecaster
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Technical indicator modeling & Random Forest trend prediction for NEPSE listed stocks.
          </p>
        </div>

        {/* --- ML STOCK FORECASTER SECTION --- */}
        <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center text-xl font-bold text-gray-900">
                <TrendingUp className="w-6 h-6 mr-2 text-emerald-500" />
                NEPSE Company Forecaster
              </h2>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Search any company symbol. Our Random Forest model will calculate technical indicators from raw dataset and generate trend prediction.
            </p>

            {/* Search Form */}
            <form onSubmit={handleFormStockSearch} className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  placeholder="Enter Stock Symbol (e.g. NABIL, NICA)"
                  value={searchSymbol}
                  onChange={(e) => setSearchSymbol(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>
              <button
                type="submit"
                disabled={isAnalyzingStock || !searchSymbol}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition flex items-center gap-2 disabled:bg-emerald-300"
              >
                {isAnalyzingStock ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
              </button>
            </form>

            {/* Quick Suggestions */}
            <div className="flex items-center gap-2 mb-6 text-xs text-gray-500">
              <span>Quick Search:</span>
              {['NABIL', 'NICA', 'GBIME', 'UPPER'].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => { setSearchSymbol(sym); handleStockSearch(sym); }}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition"
                >
                  {sym}
                </button>
              ))}
            </div>

            {/* Forecast Results & Graph */}
            {stockResult && (
              <div className="space-y-4">
                {/* Prediction Banner */}
                <div className={`p-4 border rounded-xl flex items-center justify-between ${
                  stockResult.prediction === 'UP' ? 'bg-emerald-50 border-emerald-200' :
                  stockResult.prediction === 'DOWN' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`font-bold text-base ${
                        stockResult.prediction === 'UP' ? 'text-emerald-800' :
                        stockResult.prediction === 'DOWN' ? 'text-rose-800' : 'text-amber-800'
                      }`}>
                        {stockResult.symbol}: Forecast {stockResult.prediction}
                      </span>
                      
                      {/* Live Market Price Badge */}
                      {stockResult.current_price > 0 && (
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-white text-gray-800 rounded-md border border-gray-200 shadow-xs">
                          LTP: Rs. {stockResult.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}

                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        stockResult.confidence.includes('HIGH') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {stockResult.confidence}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {stockResult.advice}
                    </p>
                  </div>
                  {stockResult.prediction === 'UP' ? (
                    <TrendingUp className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                  ) : stockResult.prediction === 'DOWN' ? (
                    <TrendingDown className="w-8 h-8 text-rose-500 flex-shrink-0" />
                  ) : (
                    <ShieldAlert className="w-8 h-8 text-amber-500 flex-shrink-0" />
                  )}
                </div>

                {/* Historical Price Recharts Graph */}
                {stockResult.historical_data && stockResult.historical_data.length > 0 && (
                  <div className="p-4 bg-gray-50/80 border border-gray-100 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                        1-Year Historical Price Trend ({stockResult.symbol})
                      </h4>
                      <span className="text-[10px] text-gray-400">250 Trading Days</span>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stockResult.historical_data}>
                          <defs>
                            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={stockResult.prediction === 'DOWN' ? '#f43f5e' : '#10b981'} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={stockResult.prediction === 'DOWN' ? '#f43f5e' : '#10b981'} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={false} axisLine={false} />
                          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            formatter={(val: any) => [`Rs. ${Number(val).toFixed(2)}`, 'Close Price']}
                            labelFormatter={(label) => `Date: ${label}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="close" 
                            stroke={stockResult.prediction === 'DOWN' ? '#e11d48' : '#059669'} 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorClose)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}