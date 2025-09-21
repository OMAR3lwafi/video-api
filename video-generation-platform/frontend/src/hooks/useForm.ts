/**
 * Custom form hooks using React Hook Form and Zod validation
 */

import { useForm as useReactHookForm, UseFormProps, FieldValues, Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'react-hot-toast'

/**
 * Enhanced useForm hook with Zod validation and error handling
 */
export function useForm<T extends FieldValues>(
  schema: z.ZodSchema<T>,
  options?: Omit<UseFormProps<T>, 'resolver'>
) {
  const form = useReactHookForm<T>({
    ...options,
    resolver: zodResolver(schema),
  })

  const handleSubmit = (
    onSubmit: (data: T) => Promise<void> | void,
    onError?: (errors: any) => void
  ) => {
    return form.handleSubmit(
      async (data) => {
        try {
          await onSubmit(data)
        } catch (error) {
          console.error('Form submission error:', error)
          toast.error(error instanceof Error ? error.message : 'An error occurred')
        }
      },
      (errors) => {
        console.error('Form validation errors:', errors)
        onError?.(errors)
        
        // Show toast for first error
        const firstError = Object.values(errors)[0]
        if (firstError?.message) {
          toast.error(firstError.message as string)
        }
      }
    )
  }

  return {
    ...form,
    handleSubmit,
  }
}

/**
 * Hook for field-level validation with debouncing
 */
export function useFieldValidation<T extends FieldValues>(
  form: ReturnType<typeof useReactHookForm<T>>,
  fieldName: Path<T>,
  validator: (value: any) => Promise<boolean> | boolean,
  debounceMs = 300
) {
  const [isValidating, setIsValidating] = React.useState(false)
  const [isValid, setIsValid] = React.useState<boolean | null>(null)

  const value = form.watch(fieldName)

  React.useEffect(() => {
    if (!value) {
      setIsValid(null)
      return
    }

    setIsValidating(true)
    
    const timeoutId = setTimeout(async () => {
      try {
        const result = await validator(value)
        setIsValid(result)
      } catch (error) {
        setIsValid(false)
      } finally {
        setIsValidating(false)
      }
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [value, validator, debounceMs])

  return { isValidating, isValid }
}

/**
 * Hook for handling file uploads in forms
 */
export function useFileUpload(
  maxFiles = 1,
  maxSize = 10 * 1024 * 1024, // 10MB
  allowedTypes: string[] = []
) {
  const [files, setFiles] = React.useState<File[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({})
  const [errors, setErrors] = React.useState<string[]>([])

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
    }

    return null
  }

  const addFiles = (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const validFiles: File[] = []
    const newErrors: string[] = []

    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        newErrors.push(`${file.name}: ${error}`)
      } else {
        validFiles.push(file)
      }
    }

    if (files.length + validFiles.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} file(s) allowed`)
      return
    }

    setFiles(prev => [...prev, ...validFiles])
    setErrors(newErrors)

    if (newErrors.length > 0) {
      newErrors.forEach(error => toast.error(error))
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const clearFiles = () => {
    setFiles([])
    setErrors([])
    setUploadProgress({})
  }

  const uploadFiles = async (
    uploadFn: (file: File, onProgress: (progress: number) => void) => Promise<any>
  ) => {
    if (files.length === 0) return []

    setUploading(true)
    const results = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileId = `${file.name}-${i}`

        const result = await uploadFn(file, (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: progress
          }))
        })

        results.push(result)
      }

      toast.success(`Successfully uploaded ${files.length} file(s)`)
      return results
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Upload failed')
      throw error
    } finally {
      setUploading(false)
    }
  }

  return {
    files,
    uploading,
    uploadProgress,
    errors,
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
  }
}

/**
 * Hook for managing multi-step forms
 */
export function useMultiStepForm<T extends Record<string, any>>(
  steps: Array<{
    key: string
    title: string
    schema: z.ZodSchema<any>
    optional?: boolean
  }>,
  initialData?: Partial<T>
) {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [formData, setFormData] = React.useState<Partial<T>>(initialData || {})
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set())

  const currentStepConfig = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  const form = useForm(currentStepConfig.schema, {
    defaultValues: formData[currentStepConfig.key] || {},
  })

  const nextStep = async () => {
    const isValid = await form.trigger()
    if (!isValid && !currentStepConfig.optional) return false

    // Save current step data
    const stepData = form.getValues()
    setFormData(prev => ({
      ...prev,
      [currentStepConfig.key]: stepData,
    }))

    // Mark step as completed
    setCompletedSteps(prev => new Set([...prev, currentStep]))

    // Move to next step
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1)
    }

    return true
  }

  const previousStep = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex)
    }
  }

  const submitForm = async (
    onSubmit: (data: T) => Promise<void> | void
  ) => {
    // Validate current step first
    const isCurrentStepValid = await form.trigger()
    if (!isCurrentStepValid && !currentStepConfig.optional) {
      return false
    }

    // Save current step data
    const currentStepData = form.getValues()
    const finalData = {
      ...formData,
      [currentStepConfig.key]: currentStepData,
    } as T

    try {
      await onSubmit(finalData)
      return true
    } catch (error) {
      console.error('Multi-step form submission error:', error)
      return false
    }
  }

  const resetForm = () => {
    setCurrentStep(0)
    setFormData(initialData || {})
    setCompletedSteps(new Set())
    form.reset()
  }

  const isStepCompleted = (stepIndex: number) => {
    return completedSteps.has(stepIndex)
  }

  const canGoToStep = (stepIndex: number) => {
    // Can always go to previous steps
    if (stepIndex <= currentStep) return true
    
    // Can only go to next step if all previous steps are completed or optional
    for (let i = 0; i < stepIndex; i++) {
      if (!isStepCompleted(i) && !steps[i].optional) {
        return false
      }
    }
    return true
  }

  return {
    // Form state
    form,
    currentStep,
    currentStepConfig,
    formData,
    completedSteps,
    
    // Navigation
    isFirstStep,
    isLastStep,
    nextStep,
    previousStep,
    goToStep,
    
    // Form actions
    submitForm,
    resetForm,
    
    // Utilities
    isStepCompleted,
    canGoToStep,
    steps,
  }
}

// Re-export React Hook Form utilities
export { useController, useFieldArray, useWatch } from 'react-hook-form'
