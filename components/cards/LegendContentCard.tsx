'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Music, FileText, Video } from 'lucide-react'

interface LegendContentCardProps {
  id: string
  title: string
  imageUrl: string
  location: string
  distance?: string
  hasAudio?: boolean
  hasText?: boolean
  hasVideo?: boolean
  onAudioClick?: () => void
  onTextClick?: () => void
  onVideoClick?: () => void
}

export default function LegendContentCard({
  title,
  imageUrl,
  location,
  distance,
  hasAudio = false,
  hasText = false,
  hasVideo = false,
  onAudioClick,
  onTextClick,
  onVideoClick
}: LegendContentCardProps) {
  return (
    <div 
      className="relative bg-[#faf8f3] rounded-xl overflow-hidden shadow-lg"
      style={{
        border: '2px solid #8b7355',
        fontFamily: '"Playfair Display", serif'
      }}
    >
      {/* Cover Image */}
      <div className="relative w-full h-48 bg-[#e8dcc8]">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover"
        />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 
          className="text-xl font-bold mb-2"
          style={{
            color: '#3d2817',
            fontFamily: '"Cinzel", serif'
          }}
        >
          {title}
        </h3>

        {/* Location and Distance */}
        <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: '#8b7355' }}>
          <span>{location}</span>
          {distance && (
            <>
              <span>·</span>
              <span>{distance}</span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {hasAudio && (
            <button
              onClick={onAudioClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300"
              style={{
                backgroundColor: '#c17817',
                color: '#faf8f3',
                border: '1px solid #8b7355'
              }}
              title="Escuchar audio"
            >
              <Music className="w-4 h-4" />
              <span className="text-sm font-medium">Audio</span>
            </button>
          )}

          {hasText && (
            <button
              onClick={onTextClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300"
              style={{
                backgroundColor: '#2d5f4f',
                color: '#faf8f3',
                border: '1px solid #8b7355'
              }}
              title="Leer texto"
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm font-medium">Texto</span>
            </button>
          )}

          {hasVideo && (
            <button
              onClick={onVideoClick}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300"
              style={{
                backgroundColor: '#2b4f6f',
                color: '#faf8f3',
                border: '1px solid #8b7355'
              }}
              title="Ver video"
            >
              <Video className="w-4 h-4" />
              <span className="text-sm font-medium">Video</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
