'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { config } from '@/lib/config';

interface SlideData {
  id: number;
  slideNumber: number;
  title: string;
  content: string;
  imagePath?: string;
  thumbnailPath?: string;
  visionInstructions?: string;
  visionModel?: string;
}

interface SlidesPreviewProps {
  slides: SlideData[];
  sessionId: string;
}

export default function SlidesPreview({ slides, sessionId }: SlidesPreviewProps) {
  const { token } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSlide, setSelectedSlide] = useState<SlideData | null>(null);
  const [slidesPerPage, setSlidesPerPage] = useState(12);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [editingVisionInstructions, setEditingVisionInstructions] = useState('');
  const [allSlides, setAllSlides] = useState<SlideData[]>(slides);

  // Update slides when props change
  useEffect(() => {
    setAllSlides(slides);
  }, [slides]);

  // Calculate pagination
  const totalPages = Math.ceil(allSlides.length / slidesPerPage);
  const startIndex = (currentPage - 1) * slidesPerPage;
  const endIndex = startIndex + slidesPerPage;
  const currentSlides = allSlides.slice(startIndex, endIndex);

  // Adjust slides per page based on screen size
  useEffect(() => {
    const updateSlidesPerPage = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setSlidesPerPage(6); // Mobile: 2x3 grid
      } else if (width < 1024) {
        setSlidesPerPage(9); // Tablet: 3x3 grid
      } else {
        setSlidesPerPage(12); // Desktop: 4x3 grid
      }
    };

    updateSlidesPerPage();
    window.addEventListener('resize', updateSlidesPerPage);
    return () => window.removeEventListener('resize', updateSlidesPerPage);
  }, []);

  const handleSlideClick = (slide: SlideData) => {
    setSelectedSlide(slide);
    setEditingVisionInstructions(slide.visionInstructions || '');
  };

  const closeModal = () => {
    setSelectedSlide(null);
    setEditingVisionInstructions('');
  };

  const handleRegenerateSlide = async (slide: SlideData) => {
    if (!token) {
      console.error('No authentication token available');
      return;
    }

    setIsRegenerating(true);
    try {
      const response = await fetch(
        config.getApiUrl(`/api/sessions/${sessionId}/slides/${slide.id}/vision`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            visionInstructions: editingVisionInstructions,
            visionModel: 'gpt-4o', // Default model for now
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to regenerate slide: ${response.statusText}`);
      }

      const updatedSessionData = await response.json();
      
      // Update the slides with the new data
      setAllSlides(updatedSessionData.slidesDetails);
      
      // Update the selected slide with the new data
      const updatedSlide = updatedSessionData.slidesDetails.find((s: SlideData) => s.id === slide.id);
      if (updatedSlide) {
        setSelectedSlide(updatedSlide);
        setEditingVisionInstructions(updatedSlide.visionInstructions || '');
      }

      console.log('✅ Slide regenerated successfully');
    } catch (error) {
      console.error('❌ Error regenerating slide:', error);
      // You might want to show a toast notification here
    } finally {
      setIsRegenerating(false);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getImageUrl = (slide: SlideData) => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    return slide.thumbnailPath ? `${backendUrl}${slide.thumbnailPath}` : 
           slide.imagePath ? `${backendUrl}${slide.imagePath}` : null;
  };

  const generateSlidePreview = (slide: SlideData) => {
    const imageUrl = getImageUrl(slide);
    
    // If we have an image URL, use it; otherwise create a text preview
    if (imageUrl) {
      return (
        <img 
          src={imageUrl} 
          alt={`Slide ${slide.slideNumber}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to text preview if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      );
    }
    
    // Text-based preview fallback
    return (
      <div className="w-full h-full bg-white p-3 flex flex-col justify-center items-center text-center">
        <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
        <h4 className="text-sm font-semibold text-gray-800 mb-1 overflow-hidden" style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {slide.title || `Slide ${slide.slideNumber}`}
        </h4>
        <p className="text-xs text-gray-600 overflow-hidden" style={{
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}>
          {slide.content || 'No content preview available'}
        </p>
      </div>
    );
  };

  if (!allSlides || allSlides.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Slides Preview</h3>
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No slides available for this session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900">
          Slides Preview ({allSlides.length} slides)
        </h3>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </button>
          {/* <button className="px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors">
            <Download className="w-4 h-4 inline mr-1" />
            Export
          </button> */}
        </div>
      </div>

      {viewMode === 'grid' ? (
        <>
          {/* Grid View */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {currentSlides.map((slide) => (
              <div
                key={slide.id}
                onClick={() => handleSlideClick(slide)}
                className="relative bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer group aspect-[4/3]"
              >
                <div className="absolute inset-0 rounded-lg overflow-hidden">
                  {generateSlidePreview(slide)}
                  <div className="hidden absolute inset-0 bg-white p-3 flex flex-col justify-center items-center text-center">
                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <h4 className="text-sm font-semibold text-gray-800 mb-1 overflow-hidden" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {slide.title || `Slide ${slide.slideNumber}`}
                    </h4>
                    <p className="text-xs text-gray-600 overflow-hidden" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {slide.content || 'No content preview available'}
                    </p>
                  </div>
                </div>
                
                <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  {slide.slideNumber}
                </div>
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSlide(slide);
                      setEditingVisionInstructions(slide.visionInstructions || '');
                    }}
                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="Edit & Regenerate"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded-lg flex items-center justify-center">
                  <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* List View */}
          <div className="space-y-3 mb-6">
            {currentSlides.map((slide) => {
              const imageUrl = getImageUrl(slide);
              return (
                <div
                  key={slide.id}
                  onClick={() => handleSlideClick(slide)}
                  className="flex items-center space-x-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="w-16 h-12 bg-white rounded border border-gray-200 flex-shrink-0 overflow-hidden">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={`Slide ${slide.slideNumber}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      Slide {slide.slideNumber}: {slide.title || 'Untitled'}
                    </h4>
                    <p className="text-sm text-gray-600 truncate">
                      {slide.content || 'No content available'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSlide(slide);
                        setEditingVisionInstructions(slide.visionInstructions || '');
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit & Regenerate"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <Maximize2 className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, allSlides.length)} of {allSlides.length} slides
          </p>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (totalPages <= 7 || page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)) {
                  return (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 3 || page === currentPage + 3) {
                  return <span key={page} className="px-2 text-gray-400">...</span>;
                }
                return null;
              })}
            </div>
            
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Slide Modal */}
      {selectedSlide && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                Slide {selectedSlide.slideNumber}: {selectedSlide.title || 'Untitled'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-8rem)] overflow-y-auto">
              {getImageUrl(selectedSlide) ? (
                <div className="mb-6">
                  <img 
                    src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}${selectedSlide.imagePath}`}
                    alt={`Slide ${selectedSlide.slideNumber}`}
                    className="w-full max-h-96 object-contain rounded-lg border"
                  />
                </div>
              ) : (
                <div className="mb-6 h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No image preview available</p>
                  </div>
                </div>
              )}
              
              {/* Vision Instructions - Editable */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">Vision Instructions</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                      Model: {selectedSlide.visionModel || 'gpt-4o'}
                    </span>
                  </div>
                </div>
                <textarea
                  value={editingVisionInstructions}
                  onChange={(e) => setEditingVisionInstructions(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                  placeholder="Enter vision instructions for analyzing this slide..."
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-500">
                    Customize how the AI analyzes this slide image to extract content and title.
                  </p>
                  <button
                    onClick={() => handleRegenerateSlide(selectedSlide)}
                    disabled={isRegenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRegenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Regenerate Content
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Generated Content */}
              {selectedSlide.content && (
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Generated Content</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedSlide.content}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 