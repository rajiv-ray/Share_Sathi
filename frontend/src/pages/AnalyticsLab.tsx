import toast from 'react-hot-toast';
import { useState, type FormEvent } from 'react';
import { BrainCircuit, TrendingUp, Newspaper, Loader2, Sparkles } from 'lucide-react';
import api from '../services/api';

interface TrendPrediction {
  prediction: string;
  message: string;
}

interface NewsAnalysis {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  summary: string[];
}

export default function AnalyticsLab() {
  const [newsText, setNewsText] = useState('');
  const [isAnalyzingNews, setIsAnalyzingNews] = useState(false);
  const [newsResult, setNewsResult] = useState<NewsAnalysis | null>(null);

  const [isPredicting, setIsPredicting] = useState(false);
  const [trendResult, setTrendResult] = useState<TrendPrediction | null>(null);
  
  const [features, setFeatures] = useState({
    Open: '', High: '', Low: '', Close: '', Volume: '', Turnover: '',
    Daily_Return: '', Log_Return: '', SMA_5: '', SMA_20: '', EMA_12: '',
    EMA_26: '', RSI_14: '', MACD: '', MACD_Signal: '', ATR_14: '',
    BB_Middle: '', BB_Upper: '', BB_Lower: '', OBV: ''
  });

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

  const handleTrendSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTrendResult(null);
    setIsPredicting(true);

    const toastId = toast.loading('Generating Random Forest forecast...');

    try {
      const payload = Object.fromEntries(
        Object.entries(features).map(([key, value]) => [key, parseFloat(value as string)])
      );
      
      const response = await api.post('/analytics/predict-trend', payload);
      setTrendResult(response.data);
      toast.success('Forecast generated!', { id: toastId });
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Prediction model is currently unavailable.';
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsPredicting(false);
    }
  };

  const loadSampleData = () => {
    setFeatures({
      Open: '1200', High: '1250', Low: '1190', Close: '1240', Volume: '50000', Turnover: '62000000',
      Daily_Return: '0.03', Log_Return: '0.029', SMA_5: '1210', SMA_20: '1180', EMA_12: '1205',
      EMA_26: '1175', RSI_14: '65', MACD: '12', MACD_Signal: '9', ATR_14: '25',
      BB_Middle: '1190', BB_Upper: '1260', BB_Lower: '1120', OBV: '1500000'
    });
  };

  return (
    <div className="min-h-screen px-4 py-8 bg-gray-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        
        <div className="mb-8">
          <h1 className="flex items-center text-3xl font-bold text-gray-900">
            <BrainCircuit className="w-8 h-8 mr-3 text-purple-600" />
            AI Analytics Lab
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Harness machine learning and Gemini AI to analyze market trends and news sentiment.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          
          <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
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
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-600 outline-none resize-none"
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
              <div className="mt-6 p-5 border border-purple-100 bg-purple-50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-semibold text-purple-900">AI Sentiment Assessment</span>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                    newsResult.sentiment === 'POSITIVE' ? 'bg-emerald-100 text-emerald-700' :
                    newsResult.sentiment === 'NEGATIVE' ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {newsResult.sentiment}
                  </span>
                </div>
                <ul className="space-y-2">
                  {newsResult.summary.map((point, i) => (
                    <li key={i} className="text-sm text-purple-800 flex items-start">
                      <span className="mr-2">•</span> {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="p-6 bg-white border border-gray-100 shadow-sm rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="flex items-center text-xl font-bold text-gray-900">
                <TrendingUp className="w-6 h-6 mr-2 text-emerald-500" />
                ML Trend Forecaster
              </h2>
              <button type="button" onClick={loadSampleData} className="text-xs font-medium text-purple-600 hover:underline">
                Load Sample Data
              </button>
            </div>

            <form onSubmit={handleTrendSubmit} className="space-y-4">
              <div className="grid grid-cols-4 gap-3 max-h-[300px] overflow-y-auto p-1">
                {Object.keys(features).map((key) => (
                  <div key={key}>
                    <label className="block mb-1 text-[10px] font-semibold text-gray-500 truncate" title={key}>{key}</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={features[key as keyof typeof features]}
                      onChange={(e) => setFeatures({ ...features, [key]: e.target.value })}
                      className="w-full py-1.5 px-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                disabled={isPredicting}
                className="flex items-center justify-center w-full py-3 mt-4 text-sm font-bold text-white transition-colors bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {isPredicting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <BrainCircuit className="w-5 h-5 mr-2" />}
                Generate Forecast
              </button>
            </form>

            {trendResult && (
              <div className={`mt-6 p-5 border rounded-xl flex items-center justify-between ${
                trendResult.prediction === 'UP' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`}>
                <div>
                  <h3 className={`font-bold text-lg mb-1 ${trendResult.prediction === 'UP' ? 'text-emerald-800' : 'text-rose-800'}`}>
                    Forecast: {trendResult.prediction}
                  </h3>
                  <p className={`text-sm ${trendResult.prediction === 'UP' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {trendResult.message}
                  </p>
                </div>
                <TrendingUp className={`w-8 h-8 ${trendResult.prediction === 'UP' ? 'text-emerald-500' : 'text-rose-500 rotate-180 transform'}`} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}