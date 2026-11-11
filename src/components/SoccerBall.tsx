import React from 'react';

interface SoccerBallProps {
  customSvgUrl?: string;
  size?: number;
  className?: string;
}

export const SoccerBall: React.FC<SoccerBallProps> = ({
  customSvgUrl,
  size = 22,
  className = ''
}) => {
  if (customSvgUrl) {
    return (
      <img
        src={customSvgUrl}
        alt="Bola de Futebol"
        width={size}
        height={size}
        className={`select-none pointer-events-none object-contain ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  // High-fidelity standard Telstar vector ball with clean shading and pentagons
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`select-none pointer-events-none drop-shadow-md ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <defs>
        <radialGradient id="ballShading" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#e8ece9" />
          <stop offset="90%" stopColor="#bac4be" />
          <stop offset="100%" stopColor="#7a857e" />
        </radialGradient>
        <radialGradient id="specular" cx="30%" cy="25%" r="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ball Base */}
      <circle cx="50" cy="50" r="48" fill="url(#ballShading)" stroke="#2b332e" strokeWidth="2" />

      {/* Center Pentagon */}
      <polygon
        points="50,33 64,43 59,59 41,59 36,43"
        fill="#181c19"
        stroke="#242c27"
        strokeWidth="1.5"
      />

      {/* Surrounding Seams & Pentagons */}
      {/* Top pentagon seam & corner */}
      <polygon
        points="50,33 50,15 38,7 28,19 36,43"
        fill="none"
        stroke="#424c45"
        strokeWidth="1.5"
      />
      <polygon
        points="50,15 62,7 72,19 64,43 50,33"
        fill="none"
        stroke="#424c45"
        strokeWidth="1.5"
      />

      {/* Top Black Accent */}
      <polygon
        points="50,2 60,7 50,15 40,7"
        fill="#181c19"
        stroke="#242c27"
        strokeWidth="1"
      />

      {/* Left Pentagon Accent */}
      <polygon
        points="10,40 22,35 27,48 18,60 7,54"
        fill="#181c19"
        stroke="#242c27"
        strokeWidth="1.2"
      />
      <line x1="36" y1="43" x2="22" y2="35" stroke="#424c45" strokeWidth="1.5" />
      <line x1="41" y1="59" x2="27" y2="48" stroke="#424c45" strokeWidth="1.5" />

      {/* Right Pentagon Accent */}
      <polygon
        points="90,40 78,35 73,48 82,60 93,54"
        fill="#181c19"
        stroke="#242c27"
        strokeWidth="1.2"
      />
      <line x1="64" y1="43" x2="78" y2="35" stroke="#424c45" strokeWidth="1.5" />
      <line x1="59" y1="59" x2="73" y2="48" stroke="#424c45" strokeWidth="1.5" />

      {/* Bottom Left Pentagon Accent */}
      <polygon
        points="30,85 41,75 35,92 23,97 18,85"
        fill="#181c19"
        stroke="#242c27"
        strokeWidth="1"
      />
      <line x1="41" y1="59" x2="41" y2="75" stroke="#424c45" strokeWidth="1.5" />

      {/* Bottom Right Pentagon Accent */}
      <polygon
        points="70,85 59,75 65,92 77,97 82,85"
        fill="#181c19"
        stroke="#242c27"
        strokeWidth="1"
      />
      <line x1="59" y1="59" x2="59" y2="75" stroke="#424c45" strokeWidth="1.5" />

      {/* Specular Light Reflection */}
      <circle cx="35" cy="30" r="28" fill="url(#specular)" />
    </svg>
  );
};
