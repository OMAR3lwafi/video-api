/**
 * 404 Not Found Page
 * Displayed when user navigates to non-existent route
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, ArrowLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        {/* 404 Animation */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ 
            duration: 0.6,
            type: 'spring',
            bounce: 0.4
          }}
          className="mb-8"
        >
          <div className="text-8xl font-bold text-primary-200 mb-4">
            404
          </div>
          <div className="w-24 h-1 bg-primary-600 mx-auto rounded-full"></div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-secondary-900 mb-4">
            Page Not Found
          </h1>
          
          <p className="text-secondary-600 mb-8">
            Sorry, we couldn't find the page you're looking for. 
            The page might have been moved, deleted, or the URL might be incorrect.
          </p>

          {/* Action buttons */}
          <div className="space-y-3">
            <Link to="/" className="block">
              <Button className="w-full" icon={Home}>
                Go to Dashboard
              </Button>
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="w-full"
            >
              <Button variant="outline" className="w-full" icon={ArrowLeft}>
                Go Back
              </Button>
            </button>
          </div>

          {/* Help text */}
          <div className="mt-8 pt-6 border-t border-secondary-200">
            <p className="text-sm text-secondary-500 mb-4">
              Need help finding something?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link to="/help" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Visit Help Center
              </Link>
              <span className="hidden sm:inline text-secondary-400">•</span>
              <Link to="/contact" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Contact Support
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
