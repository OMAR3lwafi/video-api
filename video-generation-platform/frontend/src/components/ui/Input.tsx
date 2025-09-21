/**
 * Input Component
 * Reusable input component with validation states and icons
 */

import React, { forwardRef } from 'react'
import { clsx } from 'clsx'
import { AlertCircle, CheckCircle, type LucideIcon } from 'lucide-react'
import type { InputProps } from '@/types/ui'

const inputVariants = {
  default: 'input',
  error: 'input input-error',
  success: 'input input-success',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type = 'text',
      variant = 'default',
      placeholder,
      value,
      defaultValue,
      disabled = false,
      required = false,
      readOnly = false,
      autoFocus = false,
      autoComplete,
      maxLength,
      minLength,
      min,
      max,
      step,
      pattern,
      icon: Icon,
      iconPosition = 'left',
      error,
      helperText,
      label,
      className,
      onChange,
      onBlur,
      onFocus,
      testId,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || defaultValue || '')
    const [isFocused, setIsFocused] = React.useState(false)

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value
      setInternalValue(newValue)
      onChange?.(newValue)
    }

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      onFocus?.()
    }

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      onBlur?.()
    }

    const finalVariant = error ? 'error' : variant
    const hasIcon = Icon || (finalVariant === 'error') || (finalVariant === 'success')

    return (
      <div className={clsx('space-y-1', className)}>
        {label && (
          <label className="block text-sm font-medium text-secondary-700">
            {label}
            {required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {hasIcon && iconPosition === 'left' && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {Icon && <Icon className="w-4 h-4 text-secondary-400" />}
              {!Icon && finalVariant === 'error' && (
                <AlertCircle className="w-4 h-4 text-error-500" />
              )}
              {!Icon && finalVariant === 'success' && (
                <CheckCircle className="w-4 h-4 text-success-500" />
              )}
            </div>
          )}

          <input
            ref={ref}
            type={type}
            value={value !== undefined ? value : internalValue}
            defaultValue={value === undefined ? defaultValue : undefined}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            readOnly={readOnly}
            autoFocus={autoFocus}
            autoComplete={autoComplete}
            maxLength={maxLength}
            minLength={minLength}
            min={min}
            max={max}
            step={step}
            pattern={pattern}
            data-testid={testId}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={clsx(
              inputVariants[finalVariant],
              hasIcon && iconPosition === 'left' && 'pl-10',
              hasIcon && iconPosition === 'right' && 'pr-10',
              isFocused && 'ring-2 ring-primary-500 ring-offset-2',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            {...props}
          />

          {hasIcon && iconPosition === 'right' && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {Icon && <Icon className="w-4 h-4 text-secondary-400" />}
              {!Icon && finalVariant === 'error' && (
                <AlertCircle className="w-4 h-4 text-error-500" />
              )}
              {!Icon && finalVariant === 'success' && (
                <CheckCircle className="w-4 h-4 text-success-500" />
              )}
            </div>
          )}
        </div>

        {(error || helperText) && (
          <div className="space-y-1">
            {error && (
              <p className="text-sm text-error-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {error}
              </p>
            )}
            {helperText && !error && (
              <p className="text-sm text-secondary-500">{helperText}</p>
            )}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

/**
 * Textarea component
 */
interface TextareaProps extends Omit<InputProps, 'type' | 'icon' | 'iconPosition'> {
  rows?: number
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      placeholder,
      value,
      defaultValue,
      disabled = false,
      required = false,
      readOnly = false,
      autoFocus = false,
      maxLength,
      minLength,
      rows = 3,
      resize = 'vertical',
      error,
      helperText,
      label,
      className,
      onChange,
      onBlur,
      onFocus,
      testId,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || defaultValue || '')
    const [isFocused, setIsFocused] = React.useState(false)

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value
      setInternalValue(newValue)
      onChange?.(newValue)
    }

    const handleFocus = () => {
      setIsFocused(true)
      onFocus?.()
    }

    const handleBlur = () => {
      setIsFocused(false)
      onBlur?.()
    }

    const variant = error ? 'error' : 'default'

    return (
      <div className={clsx('space-y-1', className)}>
        {label && (
          <label className="block text-sm font-medium text-secondary-700">
            {label}
            {required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          value={value !== undefined ? value : internalValue}
          defaultValue={value === undefined ? defaultValue : undefined}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          readOnly={readOnly}
          autoFocus={autoFocus}
          maxLength={maxLength}
          minLength={minLength}
          rows={rows}
          data-testid={testId}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={clsx(
            inputVariants[variant],
            'min-h-[80px]',
            resize === 'none' && 'resize-none',
            resize === 'vertical' && 'resize-y',
            resize === 'horizontal' && 'resize-x',
            resize === 'both' && 'resize',
            isFocused && 'ring-2 ring-primary-500 ring-offset-2',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          {...props}
        />

        {(error || helperText) && (
          <div className="space-y-1">
            {error && (
              <p className="text-sm text-error-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {error}
              </p>
            )}
            {helperText && !error && (
              <p className="text-sm text-secondary-500">{helperText}</p>
            )}
          </div>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
