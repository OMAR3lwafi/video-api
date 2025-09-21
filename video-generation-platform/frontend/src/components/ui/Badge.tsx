/**
 * Badge Component
 * Small status indicators and labels
 */

import React, { forwardRef } from 'react'
import { clsx } from 'clsx'
import type { BadgeProps } from '@/types/ui'

const badgeVariants = {
  primary: 'badge-primary',
  secondary: 'badge-secondary',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-primary',
}

const badgeSizes = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-0.5',
  lg: 'text-sm px-3 py-1',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      dot = false,
      className,
      children,
      testId,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        data-testid={testId}
        className={clsx(
          'badge',
          badgeVariants[variant],
          badgeSizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1" />
        )}
        
        {Icon && (
          <Icon className="w-3 h-3 mr-1" />
        )}
        
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

/**
 * Status Badge - specifically for job/task statuses
 */
interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    pending: { variant: 'secondary' as const, label: 'Pending', dot: true },
    processing: { variant: 'info' as const, label: 'Processing', dot: true },
    completed: { variant: 'success' as const, label: 'Completed', dot: true },
    failed: { variant: 'error' as const, label: 'Failed', dot: true },
    cancelled: { variant: 'secondary' as const, label: 'Cancelled', dot: true },
  }

  const config = statusConfig[status]

  return (
    <Badge
      variant={config.variant}
      dot={config.dot}
      className={className}
    >
      {config.label}
    </Badge>
  )
}
