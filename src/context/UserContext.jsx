import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [userProfile, setUserProfile] = useState(null);
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () => localStorage.getItem('ur2_token');

  const syncUser = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return null;
      }

      // Sync user data from JWT to database
      const syncResponse = await fetch(`${API_BASE_URL}/users/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!syncResponse.ok) {
        console.error('Failed to sync user');
        setLoading(false);
        return null;
      }

      // Fetch full profile with team info
      const profileResponse = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (profileResponse.ok) {
        const data = await profileResponse.json();
        setUserProfile(data);
        
        if (data.team_id) {
          setTeam({
            team_id: data.team_id,
            team_name: data.team_name,
            team_code: data.team_code,
            role: data.team_role
          });
        } else {
          setTeam(null);
        }
        
        setLoading(false);
        return data;
      }
    } catch (err) {
      console.error('Error syncing user:', err);
    }
    
    setLoading(false);
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    return await syncUser();
  }, [syncUser]);

  // Sync user on mount and when token changes
  useEffect(() => {
    const token = getToken();
    if (token) {
      syncUser();
    } else {
      setLoading(false);
    }
  }, [syncUser]);

  // Clear profile on logout
  const clearProfile = useCallback(() => {
    setUserProfile(null);
    setTeam(null);
  }, []);

  const value = {
    userProfile,
    team,
    loading,
    syncUser,
    refreshProfile,
    clearProfile,
    // Helper getters
    userId: userProfile?.user_id,
    teamId: team?.team_id,
    isInTeam: !!team,
    isTeamOwner: team?.role === 'owner'
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;
