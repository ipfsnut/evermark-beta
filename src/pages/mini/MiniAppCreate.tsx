import React from 'react';

export default function MiniAppCreate() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Create Evermark</h1>
      <p className="text-gray-400 text-center">Preserve your content forever</p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Content URL</label>
          <input 
            type="url" 
            placeholder="https://..." 
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input 
            type="text" 
            placeholder="Give your evermark a title"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea 
            placeholder="Why is this content worth preserving?"
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none resize-none"
          />
        </div>
        
        <button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 py-3 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-colors">
          Create Evermark
        </button>
      </div>
    </div>
  );
}