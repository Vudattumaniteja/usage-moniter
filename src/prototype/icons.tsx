import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

/**
 * Official Google Antigravity Logo
 * Extracted directly from Antigravity IDE application resources (jetski-logo-white.svg).
 * Inverted gravitational arch / anti-gravity curve.
 */
export const AntigravityLogo: React.FC<IconProps> = ({
  className = "w-5 h-5",
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 180 180"
      width={size || 24}
      height={size || 24}
      fill="currentColor"
      className={className}
      {...props}
    >
      <path
        d="M144.248 149.062c7.5 5.626 18.75 1.876 8.437-8.437-30.937-30-24.375-112.5-62.812-112.5-38.438 0-31.875 82.5-62.813 112.5-11.25 11.25.938 14.063 8.438 8.437 29.062-19.687 27.187-54.375 54.375-54.375 27.187 0 25.312 34.688 54.375 54.375Z"
      />
    </svg>
  );
};

/**
 * Official Google Antigravity Logo with Aurora Gradient
 */
export const AntigravityLogoGradient: React.FC<IconProps> = ({
  className = "w-5 h-5",
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 180 180"
      width={size || 24}
      height={size || 24}
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="agyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="35%" stopColor="#34d399" />
          <stop offset="70%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <path
        d="M144.248 149.062c7.5 5.626 18.75 1.876 8.437-8.437-30.937-30-24.375-112.5-62.812-112.5-38.438 0-31.875 82.5-62.813 112.5-11.25 11.25.938 14.063 8.438 8.437 29.062-19.687 27.187-54.375 54.375-54.375 27.187 0 25.312 34.688 54.375 54.375Z"
        fill="url(#agyGradient)"
      />
    </svg>
  );
};

/**
 * Official OpenAI / Codex Logo
 * The standard vector representation from official OpenAI brand assets / Simple Icons.
 */
export const OpenAILogo: React.FC<IconProps> = ({
  className = "w-5 h-5",
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size || 24}
      height={size || 24}
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
};

/**
 * Official Claude 12-Ray Radiant Sunburst Logo
 * As shown in the user's reference mockup.
 */
export const ClaudeLogo: React.FC<IconProps> = ({
  className = "w-5 h-5",
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size || 24}
      height={size || 24}
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M12 2.5a1 1 0 0 1 1 1v2.8a1 1 0 1 1-2 0V3.5a1 1 0 0 1 1-1zm0 14.4a1 1 0 0 1 1 1v2.6a1 1 0 1 1-2 0v-2.6a1 1 0 0 1 1-1zm8.5-5.9a1 1 0 0 1 1 1 1 1 0 0 1-1 1h-2.8a1 1 0 1 1 0-2h2.8zM6.3 12a1 1 0 0 1-1 1H2.5a1 1 0 1 1 0-2h2.8a1 1 0 0 1 1 1zm11.72-6.02a1 1 0 0 1 1.41 0 1 1 0 0 1 0 1.41l-2 2a1 1 0 0 1-1.41-1.41l2-2zm-12.04 12.04a1 1 0 0 1 1.41 0 1 1 0 0 1 0 1.41l-2 2a1 1 0 0 1-1.41-1.41l2-2zm12.04 0l2 2a1 1 0 0 1-1.41 1.41l-2-2a1 1 0 0 1 1.41-1.41zM5.98 5.98l2 2a1 1 0 0 1-1.41 1.41l-2-2a1 1 0 0 1 1.41-1.41zm9.32 4.02a1 1 0 0 1 1.37.37l1.3 2.25a1 1 0 0 1-1.74 1l-1.3-2.25a1 1 0 0 1 .37-1.37zm-6.6 6.6a1 1 0 0 1 1.37.37l1.3 2.25a1 1 0 0 1-1.74 1l-1.3-2.25a1 1 0 0 1 .37-1.37z" />
    </svg>
  );
};

/**
 * Official Google Gemini 4-Point Sparkle Logo
 */
export const GeminiLogo: React.FC<IconProps> = ({
  className = "w-5 h-5",
  size,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size || 24}
      height={size || 24}
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z" />
    </svg>
  );
};
