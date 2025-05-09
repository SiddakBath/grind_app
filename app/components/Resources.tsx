import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Resource } from '@/lib/database-service';

interface ResourcesProps {
  userId: string;
}

export default function Resources({ userId }: ResourcesProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchResources();
    // Listen for real-time resource updates
    const handleResourceUpdate = () => fetchResources();
    window.addEventListener('resources-updated', handleResourceUpdate);
    return () => {
      window.removeEventListener('resources-updated', handleResourceUpdate);
    };
  }, [userId]);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('user_id', userId)
        .order(sortBy === 'relevance' ? 'relevance_score' : 'created_at', { 
          ascending: false 
        });

      if (error) throw error;
      setResources(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch resources');
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter(resource => 
    filter === 'all' || resource.category.toLowerCase() === filter.toLowerCase()
  );

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'article':
        return '📄';
      case 'video':
        return '🎥';
      case 'course':
        return '📚';
      case 'tool':
        return '🛠️';
      default:
        return '🔗';
    }
  };

  if (loading) return <div className="p-4">Loading resources...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Resources</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 border rounded"
          >
            <option value="all">All Categories</option>
            <option value="article">Articles</option>
            <option value="video">Videos</option>
            <option value="course">Courses</option>
            <option value="tool">Tools</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date')}
            className="px-2 py-1 border rounded"
          >
            <option value="relevance">Sort by Relevance</option>
            <option value="date">Sort by Date</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredResources.map((resource) => (
          <div
            key={resource.id}
            className="p-4 border rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getCategoryIcon(resource.category)}</span>
                <div>
                  <h3 className="font-semibold">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {resource.title}
                    </a>
                  </h3>
                  <p className="text-gray-600 text-sm mt-1">{resource.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {resource.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      Relevance: {resource.relevance_score}%
                    </span>
                    <span className="text-xs text-gray-500">
                      Added: {new Date(resource.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredResources.length === 0 && (
        <div className="text-center text-gray-500 mt-4">
          No resources found. The AI will suggest relevant resources based on your goals and activities.
        </div>
      )}
    </div>
  );
} 