import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
export { Icon } from './Icon';

export function Button({
  variant,
  size = 'md',
  icon,
  loading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${size} ${variant ? `btn-${variant}` : ''} ${className}`}
    >
      {(loading || icon) && <Icon name={loading ? 'loading' : icon!} className={loading ? 'is-spinning' : ''} />}
      {children}
    </button>
  );
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props} />;
}

const statusIcons: Record<string, IconName> = {
  draft: 'package',
  valued: 'rupee',
  matched: 'factory',
  handed_over: 'fingerprint',
  confirmed: 'shield',
  paid: 'cash',
  settled: 'cash',
  pending: 'clock',
  disputed: 'warning',
  requested: 'clock',
  accepted: 'check',
  on_the_way: 'truck',
  arriving: 'location',
  completed: 'success',
  declined: 'close',
};
export function StatusPill({
  status,
  children,
  className = '',
}: {
  status: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`status-badge status-${status} ${className}`}>
      <Icon name={statusIcons[status] ?? 'circle'} />
      {children}
    </span>
  );
}

export function Stat({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <Card className={`stat ${className}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
    </Card>
  );
}

export function Stepper({
  items,
  current,
  className = '',
}: {
  items: { label: string; icon: IconName; detail?: string; done?: boolean }[];
  current?: number;
  className?: string;
}) {
  return (
    <ol className={`ui-stepper ${className}`}>
      {items.map((item, i) => (
        <li
          key={item.label}
          aria-current={i === current ? 'step' : undefined}
          className={`step ${item.done || (current !== undefined && i < current) ? 'is-done' : ''} ${i === current ? 'is-active' : ''}`}
        >
          <span className="step-symbol">
            <Icon name={item.done || (current !== undefined && i < current) ? 'check' : item.icon} />
          </span>
          <span>
            {item.label}
            {item.detail && <time className="step-time">{item.detail}</time>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SegmentedControl({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="group" className={`segmented-control ${className}`} {...props} />;
}
export function EmptyState({ children, icon = 'package' }: { children: ReactNode; icon?: IconName }) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <p>{children}</p>
    </div>
  );
}
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton ${className}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}
export function Banner({
  children,
  tone = 'calm',
  icon = 'save',
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: 'calm' | 'warning' | 'success';
  icon?: IconName;
}) {
  return (
    <div className={`banner banner-${tone} ${className}`} {...props}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}
