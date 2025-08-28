export const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const getAvatarColor = (name: string, gender?: string) => {
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