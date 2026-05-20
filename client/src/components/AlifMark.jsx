/**
 * Bedaya brand mark — a confident vertical stroke styled like ا (alif).
 * Used as the app logo. Calm, adult, no cartoons.
 */
export default function AlifMark({ size = 56, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      className={className}
      role="img"
      aria-label="بداية"
    >
      <rect x="2" y="2" width="52" height="52" rx="14" fill="#0F766E" />
      <text
        x="50%"
        y="56%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Noto Naskh Arabic', serif"
        fontSize="44"
        fontWeight="700"
        fill="#FAF7F2"
      >
        ا
      </text>
    </svg>
  );
}
