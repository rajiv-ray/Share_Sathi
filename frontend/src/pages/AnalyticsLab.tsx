// frontend/src/pages/AnalyticsLab.tsx
import toast from 'react-hot-toast';
import { useState, type FormEvent } from 'react';
import { 
  BrainCircuit, TrendingUp, Newspaper, Loader2, 
  Sparkles, Bot, RefreshCw, AlertCircle, Search,
  TrendingDown, ShieldAlert
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import api from '../services/api';

// --- TypeScript Interfaces ---
interface StockForecastResponse {
  symbol: string;
  prediction: 'UP' | 'DOWN' | 'UNKNOWN';
  confidence: string;
  advice: string; // Fixed: Changed from Python's 'str' to TypeScript's 'string'
  historical_data: { date: string; close: number }[];
}

interface NewsAnalysis {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  summary: string[];
}

export default function AnalyticsLab() {
  // --- Portfolio Advice State ---
  const [advice, setAdvice] = useState<string | null>(null);
  const [isAnalyzingPortfolio, setIsAnalyzingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);

  // --- News Sentiment State ---
  const [newsText, setNewsText] = useState('');
  const [isAnalyzingNews, setIsAnalyzingNews] = useState(false);
  const [newsResult, setNewsResult] = useState<NewsAnalysis | null>(null);

  // --- ML & AI Stock Forecaster State ---
  const [searchSymbol, setSearchSymbol] = useState('');
  const [isAnalyzingStock, setIsAnalyzingStock] = useState(false);
  const [stockResult, setStockResult] = useState<StockForecastResponse | null>(null);

  // Fetch AI Portfolio Advice
  const fetchPortfolioAdvice = async () => {
    setIsAnalyzingPortfolio(true);
    setPortfolioError(null);
    try {
      const response = await api.get('/analytics/portfolio-advice');
      setAdvice(response.data.advice);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to generate AI portfolio advice.';
      setPortfolioError(errorMsg);
    } finally {
      setIsAnalyzingPortfolio(false);
    }
  };

  const handleNewsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNewsResult(null);
    setIsAnalyzingNews(true);

    const toastId = toast.loading('Analyzing financial news with Gemini...');

    try {
      const response = await api.post('/analytics/analyze-news', { news_text: newsText });
      setNewsResult(response.data);
      toast.success('Analysis complete!', { id: toastId });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to analyze news article.';
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsAnalyzingNews(false);
    }
  };

  const handleStockSearch = async (symbolToSearch?: string) => {
    // Fixed: Changed Python's .strip() to JavaScript's .trim()
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
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center text-3xl font-bold text-gray-900">
              <BrainCircuit className="w-8 h-8 mr-3 text-indigo-600" />
              AI Analytics Lab
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Harness Gemini 3.6 Flash and Machine Learning to optimize your NEPSE portfolio.
            </p>
          </div>
        </div>

        {/* --- SECTION 1: PERSONALIZED AI PORTFOLIO ADVISOR --- */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  Personalized Portfolio AI Advisory
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-full">
                    Gemini 3.6 Flash
                  </span>
                </h2>
                <p className="text-xs text-gray-500">Real-time risk & strategy breakdown of your synced MeroShare holdings</p>
              </div>
            </div>
            <button
              onClick={fetchPortfolioAdvice}
              disabled={isAnalyzingPortfolio}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isAnalyzingPortfolio ? 'animate-spin' : ''}`} />
              Refresh AI Strategy
            </button>
          </div>

          <div className="p-6 md:p-8 min-h-[220px]">
            {isAnalyzingPortfolio ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-gray-500 animate-pulse">
                  Streaming portfolio metrics to Gemini 3.6 Flash...
                </p>
              </div>
            ) : portfolioError ? (
              <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{portfolioError}</p>
              </div>
            ) : advice ? (
              <div className="prose prose-indigo max-w-none text-gray-700 leading-relaxed text-sm md:text-base space-y-2">
                {advice.split('\n').map((line, idx) => {
                  if (line.startsWith('###') || line.startsWith('##')) {
                    return <h3 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-2">{line.replace(/#/g, '').trim()}</h3>;
                  }
                  if (line.startsWith('*') || line.startsWith('-')) {
                    return (
                      <li key={idx} className="ml-4 list-disc text-gray-700">
                        {line.substring(1).trim().replace(/\*\*(.*?)\*\*/g, '$1')}
                      </li>
                    );
                  }
                  return <p key={idx} className="text-gray-700">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
                })}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">Click "Refresh AI Strategy" to analyze your holdings.</p>
            )}
          </div>
        </div>

        {/* --- SECTION 2: NEWS ANALYZER & AUTOMATED ML FORECASTER --- */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          
          {/* Financial News Analyzer */}
          <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl flex flex-col justify-between">
            <div>
              <h2 className="flex items-center mb-6 text-xl font-bold text-gray-900">
                <Newspaper className="w-6 h-6 mr-2 text-blue-500" />
                Financial News Analyzer
              </h2>

              <form onSubmit={handleNewsSubmit} className="space-y-4">
                <textarea
                  required
                  minLength={20}
                  rows={6}
                  placeholder="Paste Nepalese financial news text here (minimum 20 characters)..."
                  value={newsText}
                  onChange={(e) => setNewsText(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none resize-none text-sm"
                />
                <button
                  type="submit"
                  disabled={isAnalyzingNews || newsText.length < 20}
                  className="flex items-center justify-center w-full py-3 text-sm font-bold text-white transition-colors bg-purple-600 rounded-xl hover:bg-purple-700 disabled:bg-purple-300"
                >
                  {isAnalyzingNews ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                  Analyze Sentiment
                </button>
              </form>

              {newsResult && (
                <div className="mt-6 p-5 border border-purple-100 bg-purple-50/60 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-purple-900 text-sm">AI Sentiment Assessment</span>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      newsResult.sentiment === 'POSITIVE' ? 'bg-emerald-100 text-emerald-700' :
                      newsResult.sentiment === 'NEGATIVE' ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {newsResult.sentiment}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {newsResult.summary.map((point, i) => (
                      <li key={i} className="text-xs md:text-sm text-purple-900 flex items-start">
                        <span className="mr-2 text-purple-600">•</span> {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Automated ML & AI Stock Forecaster */}
          <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center text-xl font-bold text-gray-900">
                  <TrendingUp className="w-6 h-6 mr-2 text-emerald-500" />
                  ML Stock Forecaster
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
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold text-base ${
                          stockResult.prediction === 'UP' ? 'text-emerald-800' :
                          stockResult.prediction === 'DOWN' ? 'text-rose-800' : 'text-amber-800'
                        }`}>
                          {stockResult.symbol}: Forecast {stockResult.prediction}
                        </span>
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

                  {/* 1-Year Historical Price Recharts Graph */}
                  {stockResult.historical_data && stockResult.historical_data.length > 0 && (
                    <div className="p-4 bg-gray-50/80 border border-gray-100 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          1-Year Historical Price Trend ({stockResult.symbol})
                        </h4>
                        <span className="text-[10px] text-gray-400">250 Trading Days</span>
                      </div>
                      <div className="h-48 w-full">
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
    </div>
  );
}