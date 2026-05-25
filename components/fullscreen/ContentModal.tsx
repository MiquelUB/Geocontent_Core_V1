'use client'

import { X } from 'lucide-react'

interface Content {
  id: string
  title: string
  content_type: string
  content_url: string | null
  content_text: string | null
}

interface ContentModalProps {
  content: Content | null
  onClose: () => void
}

export default function ContentModal({ content, onClose }: ContentModalProps) {
  if (!content) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{content.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {content.content_type === 'audio' && content.content_url && (
            <audio controls className="w-full">
              <source src={content.content_url} type="audio/mpeg" />
              Tu navegador no soporta audio.
            </audio>
          )}

          {content.content_type === 'video' && content.content_url && (
            <video controls className="w-full rounded-lg">
              <source src={content.content_url} type="video/mp4" />
              Tu navegador no soporta video.
            </video>
          )}

          {content.content_type === 'image' && content.content_url && (
            <img
              src={content.content_url}
              alt={content.title}
              className="w-full rounded-lg"
            />
          )}

          {content.content_type === 'text' && content.content_text && (
            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{content.content_text}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
