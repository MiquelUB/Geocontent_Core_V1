import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl shadow-sm hover:shadow-md 
        transition-all duration-300 
        ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
