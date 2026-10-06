'use client';

import { useState, useEffect } from 'react';
import { doubtService } from '@/services/doubt.service';
import { Doubt } from '@/types';
import { MessageCircle, Filter } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import DoubtDetails from '@/components/DoubtDetails';
import DoubtForm from '@/components/DoubtForm';

export default function DoubtsPage() {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedDoubtId, setSelectedDoubtId] = useState<string | null>(null);
  const [showNewDoubtForm, setShowNewDoubtForm] = useState(false);
  const [currentContentId, setCurrentContentId] = useState<string | null>(null);

  useEffect(() => {
    // Get current content ID from URL or context
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('contentId');
    setCurrentContentId(contentId);
  }, []);

  useEffect(() => {
    fetchDoubts();
  }, [filter]);

  const fetchDoubts = async () => {
    try {
      setLoading(true);
      setError(false);
      const response = await doubtService.getDoubts(filter);
      if (response.success === false) throw new Error(response.message || 'Unable to load questions');
      setDoubts(response.doubts || []);
    } catch (error) {
      setError(true);
      toast.error('Failed to fetch doubts');
    } finally {
      setLoading(false);
    }
  };

  const handleDoubtCreated = () => {
    setShowNewDoubtForm(false);
    fetchDoubts();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="shell page-section">
      <div className="flex justify-between items-center mb-8">
        <div><p className="eyebrow mb-4">Your questions / Conversations</p><h1 className="editorial-title">Ask, then grow.</h1></div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-800 rounded-lg p-2">
            <Filter className="w-5 h-5 text-gray-400 mr-2" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'open' | 'resolved')}
              className="bg-transparent text-white focus:outline-none"
            >
              <option value="all">All Doubts</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <button
            onClick={() => setShowNewDoubtForm(true)}
            className="studio-button"
          >
            Ask a Doubt
          </button>
        </div>
      </div>

      {/* New Doubt Form Modal */}
      {showNewDoubtForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-2xl">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Ask a New Doubt</h2>
              {currentContentId ? (
                <DoubtForm
                  contentId={currentContentId}
                  onDoubtCreated={handleDoubtCreated}
                />
              ) : (
                <p className="text-red-500">Please select a content to ask a doubt</p>
              )}
              <button
                onClick={() => setShowNewDoubtForm(false)}
                className="mt-4 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Doubt Details Modal */}
      {selectedDoubtId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-3xl">
            <div className="p-6">
              <DoubtDetails doubtId={selectedDoubtId} />
              <button
                onClick={() => setSelectedDoubtId(null)}
                className="mt-4 text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doubts List */}
      {error ? <div className="studio-card p-8" role="alert">Questions could not be loaded. No preview questions are shown as real data. <button className="underline" onClick={fetchDoubts}>Try again</button></div> : doubts.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No doubts found</h2>
          <p className="text-gray-400">
            {filter === 'all' 
              ? "You haven't asked any doubts yet" 
              : `No ${filter} doubts found`}
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {doubts.map((doubt) => (
            <div
              key={doubt.id}
              onClick={() => setSelectedDoubtId(doubt.id)}
              className="studio-card p-6 hover:border-[var(--forest)] transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-white">{doubt.title}</h3>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  doubt.status === 'open' ? 'bg-yellow-500' :
                  doubt.status === 'resolved' ? 'bg-green-500' : 'bg-gray-500'
                }`}>
                  {doubt.status}
                </span>
              </div>
              <p className="text-gray-400 mb-4 line-clamp-2">{doubt.description}</p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Posted on {new Date(doubt.date).toLocaleDateString()}</span>
                {doubt.resolved && <span className="text-green-500">✓ Resolved</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
