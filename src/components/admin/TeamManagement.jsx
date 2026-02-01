import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Copy, RefreshCw, LogOut, Trash2, Crown, Check, X } from 'lucide-react';
import { useUser } from '../../context/UserContext';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export default function TeamManagement() {
  const { userProfile, refreshProfile, loading: userLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [copied, setCopied] = useState(false);

  const getToken = () => localStorage.getItem('ur2_token');

  const fetchTeamMembers = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/teams/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTeam(data.team);
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (userProfile?.team_id) {
        await fetchTeamMembers();
      }
      setLoading(false);
    };
    
    if (!userLoading) {
      loadData();
    }
  }, [userProfile, userLoading, fetchTeamMembers]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teamName: newTeamName })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Team created successfully!');
        setNewTeamName('');
        setShowCreateForm(false);
        await refreshProfile();
        await fetchTeamMembers();
      } else {
        setError(data.error || 'Failed to create team');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleJoinTeam = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/teams/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teamCode: joinCode.toUpperCase() })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Successfully joined the team!');
        setJoinCode('');
        setShowJoinForm(false);
        await refreshProfile();
        await fetchTeamMembers();
      } else {
        setError(data.error || 'Failed to join team');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleLeaveTeam = async () => {
    if (!window.confirm('Are you sure you want to leave this team?')) return;

    setError(null);
    setSuccess(null);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/teams/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Successfully left the team');
        setTeam(null);
        setMembers([]);
        await refreshProfile();
      } else {
        setError(data.error || 'Failed to leave team');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from the team?`)) return;

    setError(null);
    setSuccess(null);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/teams/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Member removed successfully');
        await fetchTeamMembers();
      } else {
        setError(data.error || 'Failed to remove member');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const handleRegenerateCode = async () => {
    if (!window.confirm('Regenerate invite code? The old code will no longer work.')) return;

    setError(null);
    setSuccess(null);

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/teams/regenerate-code`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (response.ok) {
        setTeam(data);
        setSuccess('Invite code regenerated!');
      } else {
        setError(data.error || 'Failed to regenerate code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  const copyInviteCode = () => {
    if (team?.team_code) {
      navigator.clipboard.writeText(team.team_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading team info...</span>
      </div>
    );
  }

  const isOwner = userProfile?.team_role === 'owner';

  return (
    <div className="p-6 space-y-6">
      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* No Team View */}
      {!team ? (
        <div className="space-y-6">
          <div className="text-center py-8">
            <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Team Yet</h3>
            <p className="text-gray-500 mb-6">
              Create a team to share trials with your colleagues, or join an existing team with an invite code.
            </p>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={() => { setShowCreateForm(true); setShowJoinForm(false); }}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Create Team
              </button>
              <button
                onClick={() => { setShowJoinForm(true); setShowCreateForm(false); }}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Users className="w-4 h-4 mr-2" />
                Join Team
              </button>
            </div>
          </div>

          {/* Create Team Form */}
          {showCreateForm && (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h4 className="text-md font-medium text-gray-900 mb-4">Create a New Team</h4>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g., Garg Lab Team"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={2}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Join Team Form */}
          {showJoinForm && (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h4 className="text-md font-medium text-gray-900 mb-4">Join an Existing Team</h4>
              <form onSubmit={handleJoinTeam} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Invite Code
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g., ABC123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase tracking-widest font-mono"
                    required
                    maxLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ask your team owner for the 6-character invite code
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Join Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowJoinForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        /* Team View */
        <div className="space-y-6">
          {/* Team Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-semibold text-gray-900">{team.team_name}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
              
              <button
                onClick={handleLeaveTeam}
                className="inline-flex items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Leave Team
              </button>
            </div>

            {/* Invite Code Section */}
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Team Invite Code</p>
                  <p className="text-2xl font-mono font-bold tracking-widest text-gray-900">
                    {team.team_code}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyInviteCode}
                    className={`inline-flex items-center px-3 py-2 rounded-lg transition-colors ${
                      copied 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </>
                    )}
                  </button>
                  {isOwner && (
                    <button
                      onClick={handleRegenerateCode}
                      className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      title="Generate new invite code"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Share this code with colleagues to invite them to your team
              </p>
            </div>
          </div>

          {/* Team Members */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Team Members</h4>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {member.picture ? (
                      <img
                        src={member.picture}
                        alt={member.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 font-medium">
                          {member.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{member.name}</p>
                        {member.role === 'owner' && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                        {member.user_id === userProfile?.user_id && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  
                  {isOwner && member.user_id !== userProfile?.user_id && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id, member.name)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Team Benefits Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h5 className="font-medium text-amber-800 mb-2">🔬 Shared Workspace</h5>
            <p className="text-sm text-amber-700">
              All team members can view and manage trials created by anyone in the team. 
              This makes collaboration easy - start a test, and your colleagues can monitor its progress!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
