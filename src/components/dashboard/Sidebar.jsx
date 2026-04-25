import React from 'react';
import { Home, Settings, HelpCircle, ScanSearch, ChevronLeft, ChevronRight, LogOut, User } from 'lucide-react';

export default function Navbar({ activePage, setActivePage, user, onLogout }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const navItems = [
    { name: 'home', icon: <Home />, label: 'Home' },
    { name: 'image-analysis', icon: <ScanSearch />, label: 'Image Analysis' },
    { name: 'settings', icon: <Settings />, label: 'Settings' },
    { name: 'help', icon: <HelpCircle />, label: 'Help' }
  ];

  return (
    <div className={`bg-gray-900 text-white h-full transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'} flex flex-col`}>
      <button onClick={() => setCollapsed(!collapsed)} className="p-3 text-left">
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>
      
      {/* Navigation Items */}
      {navItems.map((item) => (
        <button
          key={item.name}
          onClick={() => setActivePage(item.name)}
          className={`flex items-center gap-2 p-3 text-sm hover:bg-gray-700 ${activePage === item.name ? 'bg-gray-800' : ''}`}
        >
          {item.icon}
          {!collapsed && item.label}
        </button>
      ))}
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* User Info & Logout */}
      {user && (
        <div className="border-t border-gray-700">
          <div className={`p-3 ${collapsed ? 'text-center' : ''}`}>
            <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
              <User size={16} />
              {!collapsed && <span className="truncate">{user.email || user.name || user.username}</span>}
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 p-2 text-sm text-red-400 hover:bg-gray-800 rounded transition-colors"
            >
              <LogOut size={16} />
              {!collapsed && 'Logout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}