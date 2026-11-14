import { useState } from 'react';
import { Coffee } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackTitle = 'TODAY CAFE',
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F4ECE1] via-[#EFE3D2] to-[#E6D3BC] text-[#6E5A4F] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Coffee className="w-8 h-8 mb-2 text-[#B85223]" strokeWidth={1.5} />
        <span className="text-sm font-medium text-[#2B1E16]">{fallbackTitle}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}
