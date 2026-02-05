import React, { useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useIsMobile } from '../hooks/useMediaQuery';
import { triggerHaptic } from '../hooks/useHaptic';
import { colors } from '../utils/styles';
import { Button } from './shared';

interface ShareComparisonScreenshotProps {
  targetRef: React.RefObject<HTMLElement | null>;
  kingdomNumbers: number[];
  winner?: number | 'tie' | null;
}

const ShareComparisonScreenshot: React.FC<ShareComparisonScreenshotProps> = ({
  targetRef,
  kingdomNumbers,
  winner,
}) => {
  const isMobile = useIsMobile();
  const [isCapturing, setIsCapturing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const captureScreenshot = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    if (!targetRef.current) return null;
    
    setIsCapturing(true);
    triggerHaptic('light');

    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2, // Higher resolution for better quality
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      
      canvasRef.current = canvas;
      return canvas;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [targetRef]);

  const handlePreview = useCallback(async () => {
    const canvas = await captureScreenshot();
    if (canvas) {
      setPreviewUrl(canvas.toDataURL('image/png'));
      setShowOptions(true);
      triggerHaptic('success');
    }
  }, [captureScreenshot]);

  const handleDownload = useCallback(async () => {
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = await captureScreenshot();
    }
    if (!canvas) return;

    triggerHaptic('medium');
    
    const link = document.createElement('a');
    const filename = `kingshot-compare-${kingdomNumbers.join('-vs-')}.png`;
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    setShowOptions(false);
    setPreviewUrl(null);
  }, [captureScreenshot, kingdomNumbers]);

  const handleShare = useCallback(async () => {
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = await captureScreenshot();
    }
    if (!canvas) return;

    triggerHaptic('medium');

    // Convert canvas to blob for sharing
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const winnerText = winner === 'tie' 
        ? "It's a tie!" 
        : winner 
          ? `Kingdom ${winner} wins!` 
          : '';
      
      const shareText = `⚔️ Kingdom Comparison: ${kingdomNumbers.map(k => `K${k}`).join(' vs ')}\n${winnerText}\n\nCompare your kingdoms at ks-atlas.com/compare`;

      // Check if Web Share API is available with files support
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `kingshot-compare-${kingdomNumbers.join('-vs-')}.png`, { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Kingshot Atlas - Kingdom Comparison',
              text: shareText,
              files: [file],
            });
            setShowOptions(false);
            setPreviewUrl(null);
            return;
          } catch (err) {
            // User cancelled or share failed
            if ((err as Error).name !== 'AbortError') {
              console.error('Share failed:', err);
            }
          }
        }
      }
      
      // Fallback: Copy to clipboard if available
      if (navigator.clipboard && 'write' in navigator.clipboard) {
        try {
          // Create a single ClipboardItem with just the image
          const clipboardItem = new ClipboardItem({
            'image/png': blob,
          });
          await navigator.clipboard.write([clipboardItem]);
          alert('Screenshot copied to clipboard!');
          setShowOptions(false);
          setPreviewUrl(null);
          canvasRef.current = null; // Clear the canvas ref to prevent duplicate references
          return;
        } catch (err) {
          console.error('Clipboard write failed:', err);
        }
      }
      
      // Final fallback: Download
      handleDownload();
    }, 'image/png');
  }, [captureScreenshot, kingdomNumbers, winner, handleDownload]);

  const handleCopyLink = useCallback(() => {
    triggerHaptic('light');
    const url = `${window.location.origin}/compare?kingdoms=${kingdomNumbers.join(',')}`;
    navigator.clipboard.writeText(url);
    alert('Comparison link copied!');
  }, [kingdomNumbers]);

  const closePreview = useCallback(() => {
    setShowOptions(false);
    setPreviewUrl(null);
    canvasRef.current = null;
  }, []);

  return (
    <>
      <Button
        variant="secondary"
        size={isMobile ? 'md' : 'md'}
        onClick={handlePreview}
        disabled={isCapturing}
        loading={isCapturing}
        icon={!isCapturing ? <span>📸</span> : undefined}
        fullWidth={isMobile}
      >
        {isCapturing ? 'Capturing...' : 'Share Screenshot'}
      </Button>

      {/* Preview Modal */}
      {showOptions && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={closePreview}
        >
          <div
            style={{
              maxWidth: '90vw',
              maxHeight: '70vh',
              overflow: 'auto',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              marginBottom: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Comparison Preview"
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  display: 'block',
                }}
              />
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="primary" onClick={handleShare} icon={<span>📤</span>}>
              Share
            </Button>
            
            <Button variant="ghost" onClick={handleDownload} icon={<span>💾</span>}>
              Download
            </Button>

            <Button variant="ghost" onClick={handleCopyLink} icon={<span>🔗</span>}>
              Copy Link
            </Button>

            <Button variant="danger" onClick={closePreview} icon={<span>✕</span>}>
              Close
            </Button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default ShareComparisonScreenshot;
