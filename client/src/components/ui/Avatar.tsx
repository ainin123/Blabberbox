import React from 'react';

interface AvatarProps {
  color: string;
  username: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
}

const Avatar = React.memo(({ color, username, size = 'md', isOnline }: AvatarProps) => (
  <div className={`avatar avatar-${size}`} style={{ background: color }}>
    {username.charAt(0).toUpperCase()}
    {isOnline !== undefined && (
      <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
    )}
  </div>
));

Avatar.displayName = 'Avatar';
export default Avatar;
