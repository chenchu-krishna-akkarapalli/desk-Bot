import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = '',
  onClick,
}: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`iphone-glass ${className}`}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
