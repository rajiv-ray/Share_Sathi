import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Building2, ExternalLink, Copy, CheckCircle2, Edit2, Save, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function IPOChecker() {
  const [boid, setBoid] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch the BOID from the database when the page loads
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.data.boid) {
          setBoid(response.data.boid);
        } else {
          setIsEditing(true); // Show input if database BOID is null/empty
        }
      } catch (error) {
        toast.error('Failed to load your profile data.');
        setIsEditing(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  // Save the BOID to the database
  const handleSaveBoid = async () => {
    if (boid.length !== 16 || !/^\d+$/.test(boid)) {
      toast.error('BOID must be exactly 16 digits.');
      return;
    }

    setIsSaving(true);
    try {
      await api.put('/auth/boid', { boid });
      setIsEditing(false);
      toast.success('BOID saved to database securely!');
    } catch (error) {
      toast.error('Failed to save BOID to the database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyBoid = () => {
    if (boid) {
      navigator.clipboard.writeText(boid);
      setHasCopied(true);
      toast.success('BOID copied to clipboard!');
      
      // Reset the copy icon after 2 seconds
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  const handleOpenPortal = () => {
    // This replaces the current tab's URL with the CDSC URL
    window.location.href = 'https://iporesult.cdsc.com.np';
  };

  return (
    <div className="min-h-screen px-4 py-8 bg-gray-50 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="flex items-center justify-center text-3xl font-bold text-gray-900 sm:justify-start">
            <Building2 className="w-8 h-8 mr-3 text-blue-600" />
            IPO Result Portal
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Check your allotment status directly through the official CDSC MeroShare portal.
          </p>
        </div>

        <div className="overflow-hidden bg-white border border-gray-100 shadow-sm rounded-2xl">
          <div className="p-6 sm:p-8">
            
            {/* Step 1: Manage & Copy BOID */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center text-lg font-bold text-gray-900">
                  <span className="flex items-center justify-center w-6 h-6 mr-3 text-sm text-blue-600 bg-blue-100 rounded-full">1</span>
                  Your BOID
                </h2>
                {!isEditing && boid && !isLoading && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center text-sm font-medium text-gray-500 transition-colors hover:text-blue-600"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                )}
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center p-6 bg-gray-50 rounded-xl">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : isEditing ? (
                <div className="p-4 border bg-blue-50 border-blue-100 rounded-xl">
                  <label className="block mb-2 text-sm font-semibold text-gray-700">
                    Enter your 16-digit BOID to link it to your account
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      maxLength={16}
                      placeholder="e.g., 1301234567890000"
                      value={boid}
                      onChange={(e) => setBoid(e.target.value.replace(/\D/g, ''))} // Only allow numbers
                      className="flex-1 px-4 py-2.5 font-mono text-gray-700 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                    <button
                      onClick={handleSaveBoid}
                      disabled={isSaving}
                      className="flex items-center justify-center px-6 py-2.5 text-sm font-bold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center p-1 border border-gray-200 bg-gray-50 rounded-xl">
                  <div className="flex-1 px-4 py-2 font-mono text-lg tracking-wider text-gray-700 select-all">
                    {boid}
                  </div>
                  <button
                    onClick={handleCopyBoid}
                    className={`flex items-center px-5 py-2.5 text-sm font-semibold text-white transition-all rounded-lg ${
                      hasCopied ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-gray-800 hover:bg-gray-900'
                    }`}
                  >
                    {hasCopied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <hr className="mb-8 border-gray-100" />

            {/* Step 2: Open CDSC */}
            <div>
              <h2 className="flex items-center mb-4 text-lg font-bold text-gray-900">
                <span className="flex items-center justify-center w-6 h-6 mr-3 text-sm text-blue-600 bg-blue-100 rounded-full">2</span>
                Check official results
              </h2>
              <p className="mb-6 text-sm text-gray-500">
                Click below to securely open the official CDSC portal. Simply paste your copied BOID and fill out the CAPTCHA to view your results.
              </p>
              
              <button
                onClick={handleOpenPortal}
                className="flex items-center justify-center w-full py-4 text-sm font-bold text-blue-700 transition-colors border-2 bg-blue-50 border-blue-100 rounded-xl hover:bg-blue-100 hover:border-blue-200"
              >
                Open iporesult.cdsc.com.np
                <ExternalLink className="w-5 h-5 ml-2" />
              </button>
            </div>

          </div>
        </div>
        
      </div>
    </div>
  );
}