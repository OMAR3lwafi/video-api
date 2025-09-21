/**
 * Header Component
 * Top navigation bar with branding, search, and user actions
 */

import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Menu, 
  Search, 
  Bell, 
  Settings, 
  User,
  Moon,
  Sun,
  Monitor
} from 'lucide-react'
import { Button, IconButton } from '@/components/ui'
import { useAppStore } from '@/stores'

export function Header() {
  const location = useLocation()
  const { 
    toggleSidebar, 
    theme, 
    setTheme, 
    getEffectiveTheme,
    notifications 
  } = useAppStore()

  const unreadCount = notifications.filter(n => !n.read).length
  const effectiveTheme = getEffectiveTheme()

  const handleThemeToggle = () => {
    const themes = ['light', 'dark', 'system'] as const
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setTheme(nextTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return Sun
      case 'dark': return Moon
      case 'system': return Monitor
      default: return Sun
    }
  }

  const ThemeIcon = getThemeIcon()

  // Get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard'
      case '/create': return 'Create Video'
      case '/jobs': return 'Jobs'
      default:
        if (location.pathname.startsWith('/jobs/')) return 'Job Details'
        return 'Video Platform'
    }
  }

  return (
    <header className="bg-white border-b border-secondary-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center gap-4">
          <IconButton
            icon={Menu}
            variant="ghost"
            onClick={toggleSidebar}
            className="lg:hidden"
          />
          
          <div>
            <h1 className="text-xl font-semibold text-secondary-900">
              {getPageTitle()}
            </h1>
            <p className="text-sm text-secondary-600 hidden sm:block">
              Create and manage your video content
            </p>
          </div>
        </div>

        {/* Center section - Search */}
        <div className="hidden md:flex flex-1 max-w-lg mx-8">
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-secondary-400" />
            </div>
            <input
              type="text"
              placeholder="Search jobs, templates..."
              className="input pl-10 w-full"
            />
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Search button for mobile */}
          <IconButton
            icon={Search}
            variant="ghost"
            className="md:hidden"
          />

          {/* Theme toggle */}
          <IconButton
            icon={ThemeIcon}
            variant="ghost"
            onClick={handleThemeToggle}
            title={`Current theme: ${theme}`}
          />

          {/* Notifications */}
          <div className="relative">
            <IconButton
              icon={Bell}
              variant="ghost"
            />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-error-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </div>

          {/* Settings */}
          <IconButton
            icon={Settings}
            variant="ghost"
          />

          {/* User menu */}
          <div className="flex items-center gap-3 ml-4 pl-4 border-l border-secondary-200">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-secondary-900">
                John Doe
              </p>
              <p className="text-xs text-secondary-600">
                john@example.com
              </p>
            </div>
            
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary-600" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
