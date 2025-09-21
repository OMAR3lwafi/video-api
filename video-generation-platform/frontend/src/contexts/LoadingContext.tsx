/**
 * Loading Context
 * Provides global loading state management
 */

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface LoadingState {
  isLoading: boolean
  loadingText?: string
  progress?: number
}

interface LoadingContextType {
  loading: LoadingState
  setLoading: (loading: boolean, text?: string, progress?: number) => void
  updateProgress: (progress: number) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

interface LoadingProviderProps {
  children: ReactNode
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [loading, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    loadingText: undefined,
    progress: undefined,
  })

  const setLoading = (isLoading: boolean, text?: string, progress?: number) => {
    setLoadingState({
      isLoading,
      loadingText: text,
      progress,
    })
  }

  const updateProgress = (progress: number) => {
    setLoadingState(prev => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress)),
    }))
  }

  const value: LoadingContextType = {
    loading,
    setLoading,
    updateProgress,
  }

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <GlobalLoadingOverlay />
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}

/**
 * Global loading overlay component
 */
function GlobalLoadingOverlay() {
  const { loading } = useLoading()

  return (
    <AnimatePresence>
      {loading.isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4"
          >
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4">
                <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
              </div>
              
              {loading.loadingText && (
                <h3 className="text-lg font-semibold text-secondary-900 mb-2">
                  {loading.loadingText}
                </h3>
              )}
              
              {loading.progress !== undefined && (
                <div className="space-y-2">
                  <div className="w-full bg-secondary-200 rounded-full h-2">
                    <motion.div
                      className="bg-primary-600 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${loading.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-sm text-secondary-600">
                    {Math.round(loading.progress)}%
                  </p>
                </div>
              )}
              
              {!loading.loadingText && !loading.progress && (
                <p className="text-secondary-600">Loading...</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Hook for managing loading states with automatic cleanup
 */
export function useLoadingState(initialLoading = false) {
  const { setLoading, updateProgress } = useLoading()
  const [isLoading, setIsLoading] = useState(initialLoading)

  const startLoading = (text?: string, progress?: number) => {
    setIsLoading(true)
    setLoading(true, text, progress)
  }

  const stopLoading = () => {
    setIsLoading(false)
    setLoading(false)
  }

  const setProgress = (progress: number) => {
    updateProgress(progress)
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (isLoading) {
        setLoading(false)
      }
    }
  }, [isLoading, setLoading])

  return {
    isLoading,
    startLoading,
    stopLoading,
    setProgress,
  }
}

/**
 * Higher-order component for automatic loading states
 */
export function withLoading<P extends object>(
  Component: React.ComponentType<P>,
  loadingText = 'Loading...'
) {
  return function LoadingWrapper(props: P & { loading?: boolean }) {
    const { loading = false, ...componentProps } = props
    const { setLoading } = useLoading()

    React.useEffect(() => {
      setLoading(loading, loadingText)
    }, [loading, setLoading])

    return <Component {...(componentProps as P)} />
  }
}
