import React, { useEffect, useRef } from 'react';
import { User } from '@shared/schema';
import { cn } from '@/lib/utils';
// Inline utility functions since module import is having issues
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (name: string, gender?: string) => {
  // Use gender-based colors if gender is provided
  if (gender === 'female') {
    return 'bg-gradient-to-br from-red-400 to-red-600';
  }
  if (gender === 'male') {
    return 'bg-gradient-to-br from-blue-400 to-blue-600';
  }
  
  // Fallback to name-based colors for users without gender info
  const colors = [
    'bg-gradient-to-br from-green-400 to-green-600',
    'bg-gradient-to-br from-purple-400 to-purple-600',
    'bg-gradient-to-br from-orange-400 to-orange-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-indigo-400 to-indigo-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
  ];
  const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

interface MentionDropdownProps {
  users: User[];
  selectedIndex: number;
  onSelectUser: (user: User) => void;
  position: { top: number; left: number };
}

export default function MentionDropdown({ 
  users, 
  selectedIndex, 
  onSelectUser, 
  position 
}: MentionDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dropdownRef.current && selectedIndex >= 0) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (users.length === 0) return null;

  return (
    <div 
      ref={dropdownRef}
      className="absolute bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
      style={{ 
        top: position.top, 
        left: position.left,
        minWidth: '200px'
      }}
    >
      {users.map((user, index) => (
        <div
          key={user.id}
          className={cn(
            "flex items-center space-x-2 px-3 py-2 cursor-pointer hover:bg-gray-50",
            index === selectedIndex && "bg-blue-50"
          )}
          onClick={() => onSelectUser(user)}
          data-testid={`mention-user-${user.id}`}
        >
          {user.primaryPhoto?.photoUrl ? (
            <img 
              src={user.primaryPhoto.photoUrl}
              alt={`${user.displayName} profile`}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium",
              getAvatarColor(user.displayName, user.gender)
            )}>
              {getInitials(user.displayName)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.displayName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              @{user.username}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}