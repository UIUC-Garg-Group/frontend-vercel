import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function AuthCallback({ onLogin }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      try {
        // Decode JWT to get user info (JWT is base64 encoded)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const user = {
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          googleId: payload.googleId
        };
        
        // Store token and user info
        localStorage.setItem('ur2_token', token);
        localStorage.setItem('ur2_user', JSON.stringify(user));
        
        // Call onLogin callback
        onLogin(user, token);
        
        // Redirect to dashboard
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Failed to parse token:', error);
        navigate('/login?error=invalid_token', { replace: true });
      }
    } else {
      navigate('/login?error=no_token', { replace: true });
    }
  }, [searchParams, onLogin, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 rounded-lg mb-4 animate-pulse">
          <span className="text-2xl font-bold text-white">UR2</span>
        </div>
        <p className="text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}
