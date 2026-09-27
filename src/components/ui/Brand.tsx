import { useI18n } from '../../i18n/I18nProvider';

export function Brand({ hero = false }: { hero?: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`brand ${hero ? 'brand-hero' : ''}`}>
      <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="20" fill="currentColor" />
        <path
          d="M19 18v28m26-28L28 32l17 14"
          stroke="#fff"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m39 17 9 1-1 9M25 47l-9-1 1-9"
          stroke="#efb744"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg className="brand-wordmark" viewBox="0 0 220 32" role="img" aria-label={t('appName')}>
        <text x={hero ? 110 : 0} y="24" textAnchor={hero ? 'middle' : 'start'} fill="currentColor">
          {t('appName')}
        </text>
      </svg>
    </span>
  );
}

export function RoleIllustration({ recycler = false }: { recycler?: boolean }) {
  return (
    <svg
      className="role-illustration"
      viewBox="0 0 120 96"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="60" cy="46" r="40" fill="currentColor" opacity=".07" stroke="none" />
      {recycler ? (
        <>
          <path d="M22 76V43l23-14v14l22-14v14h28v33ZM83 43V20h10l3 23" />
          <path d="M34 54h7v9h-7Zm20 0h7v9h-7Zm20 0h8v22" />
          <path d="m51 16 6-6 6 6m-6-6v15" stroke="#b98016" />
          <path d="M17 81h86" />
        </>
      ) : (
        <>
          <path d="M22 62h71l-6 13H32Zm-8-26h8l10 39M36 57V34h25v23m-20-17h15v11H41Zm25 17V27h18v30m-13-23h8m-8 6h8" />
          <circle cx="38" cy="81" r="6" />
          <circle cx="80" cy="81" r="6" />
          <path d="m92 23 5-6 6 6m-6-6v16" stroke="#b98016" />
        </>
      )}
    </svg>
  );
}
