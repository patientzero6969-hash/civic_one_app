// types/index.ts - Type definitions
export interface User {
  name: string;
  email: string;
  phone: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  status: string;
  date: string;
  image?: string;
  updates: Array<{
    id: string;
    message: string;
    date: string;
    author: string;
  }>;
}

export interface ActivityItem {
  id: string;
  title: string;
  location: string;
  type: 'resolved' | 'new' | 'in-progress';
  time: string;
}

export interface QuickStats {
  totalIssues: number;
  resolved: number;
  inProgress: number;
  pending: number;
  userReports: number;
  communityRank: string;
}

//sibhi's update
export interface IssueMarker {
  id: string;
  title: string;
  category: string;
  location: string;
  distance: string;
  upvotes: number;
  status: 'pending' | 'in-progress' | 'resolved';
  timestamp: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}