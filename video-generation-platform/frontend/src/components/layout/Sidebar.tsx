/**
 * Sidebar Component
 * Navigation sidebar with menu items and branding
 */

import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Home, 
  Plus, 
  List, 
  Settings, 
  HelpCircle,
  ChevronLeft,
  Video
} from 'lucide-react'
import { IconButton } from '@/components/ui'
import { useAppStore } from '@/stores'
import { clsx } from 'clsx'

interface NavItemProps {
  to: string
  icon: React.ElementType
  label: string
  collapsed: boolean
  badge?: string | number
}

function NavItem({ to, icon: Icon, label, collapsed, badge }: NavItemProps) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link to={to}>
      <motion.div
        whileHover={{ x: collapsed ? 4 : 2 }}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
          isActive 
            ? 'bg-primary-100 text-primary-900' 
            : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        
        {!collapsed && (
          <>
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="bg-primary-100 text-primary-800 text-xs px-1.5 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </>
        )}
        
        {isActive && (
          <motion.div
            layoutId="activeTab"
            className="absolute inset-0 bg-primary-100 rounded-lg -z-10"
            initial={false}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
          />
        )}
      </motion.div>
    </Link>
  )
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()

  const navItems = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/create', icon: Plus, label: 'Create Video' },
    { to: '/jobs', icon: List, label: 'Jobs', badge: '3' },
  ]

  const bottomNavItems = [
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/help', icon: HelpCircle, label: 'Help & Support' },
  ]

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 64 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-white border-r border-secondary-200 z-40 flex flex-col"
    >
      {/* Header */}
      <div className="p-6 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-secondary-900">
                  VideoGen
                </h2>
                <p className="text-xs text-secondary-600">
                  Pro Platform
                </p>
              </div>
            </motion.div>
          )}
          
          {sidebarCollapsed && (
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mx-auto">
              <Video className="w-5 h-5 text-white" />
            </div>
          )}
          
          {!sidebarCollapsed && (
            <IconButton
              icon={ChevronLeft}
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={sidebarCollapsed}
            badge={item.badge}
          />
        ))}
      </nav>

      {/* Bottom navigation */}
      <div className="p-4 border-t border-secondary-200 space-y-2">
        {bottomNavItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={sidebarCollapsed}
          />
        ))}
      </div>

      {/* Expand button when collapsed */}
      {sidebarCollapsed && (
        <div className="p-4 border-t border-secondary-200">
          <IconButton
            icon={ChevronLeft}
            variant="ghost"
            onClick={toggleSidebar}
            className="w-full rotate-180"
          />
        </div>
      )}
    </motion.aside>
  )
}
