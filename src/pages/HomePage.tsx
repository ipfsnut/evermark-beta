// src/pages/HomePage.tsx
import React from 'react';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyber-primary to-cyber-secondary bg-clip-text text-transparent mb-4">
          Welcome to Evermark Beta
        </h1>
        <p className="text-gray-400 text-lg">
          Content curation on the blockchain - Coming soon
        </p>
      </div>
    </div>
  );
}

// src/pages/ExplorePage.tsx
import React from 'react';

export default function ExplorePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Explore Evermarks</h1>
      <p className="text-gray-400">Discover amazing content preserved forever</p>
    </div>
  );
}

// src/pages/ProfilePage.tsx
import React from 'react';

export default function ProfilePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Your Profile</h1>
      <p className="text-gray-400">Manage your Evermark collection and preferences</p>
    </div>
  );
}

// src/pages/LeaderboardPage.tsx
import React from 'react';

export default function LeaderboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Leaderboard</h1>
      <p className="text-gray-400">Top-voted content and active curators</p>
    </div>
  );
}

// src/pages/StakingPage.tsx
import React from 'react';

export default function StakingPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Staking</h1>
      <p className="text-gray-400">Stake $EMARK tokens to earn voting power</p>
    </div>
  );
}

// src/pages/EvermarkDetailPage.tsx
import React from 'react';
import { useParams } from 'react-router-dom';

export default function EvermarkDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Evermark #{id}</h1>
      <p className="text-gray-400">Detailed view of this preserved content</p>
    </div>
  );
}

// src/pages/CreateEvermarkPage.tsx
import React from 'react';

export default function CreateEvermarkPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Create Evermark</h1>
      <p className="text-gray-400">Preserve content forever on the blockchain</p>
    </div>
  );
}

// src/pages/NotFoundPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { HomeIcon } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-600 mb-4">404</h1>
        <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 bg-cyber-primary text-black font-medium rounded-lg hover:bg-opacity-90 transition-colors"
        >
          <HomeIcon className="h-5 w-5 mr-2" />
          Go Home
        </Link>
      </div>
    </div>
  );
}