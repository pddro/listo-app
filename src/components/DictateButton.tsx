'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { API } from '@/lib/api';

interface DictateButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  position?: 'floating' | 'inline';
}

const MAX_RECORDING_TIME = 90000; // 90 seconds

export function DictateButton({ onTranscription, disabled = false, position = 'floating' }: DictateButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Analyze audio levels for visualization
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255); // Normalize to 0-1

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      cancelledRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analysis
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start analyzing
      analyzeAudio();

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Stop animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Process the recorded audio (skip if cancelled)
        if (!cancelledRef.current && audioChunksRef.current.length > 0) {
          await processAudio();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      setIsRecording(true);
      startTimeRef.current = Date.now();

      // Timer for display
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setRecordingTime(elapsed);

        // Auto-stop at max time
        if (elapsed >= MAX_RECORDING_TIME) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Mark as cancelled so onstop handler skips processing
      cancelledRef.current = true;
      audioChunksRef.current = [];

      // Stop the recorder (onstop will fire but with empty chunks)
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setRecordingTime(0);
    }
  };

  const processAudio = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      // Send to transcription API
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch(API.transcribe, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      if (data.text) {
        onTranscription(data.text);
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  };

  // Click/tap to toggle recording (same behavior for mobile and desktop)
  const handleClick = () => {
    if (disabled || isProcessing) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Format time as MM:SS
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate remaining time
  const remainingTime = MAX_RECORDING_TIME - recordingTime;
  const progress = recordingTime / MAX_RECORDING_TIME;

  const isFloating = position === 'floating';

  return (
    <>
      {/* Button container */}
      <div
        className={`
          flex flex-col items-center
          ${isFloating ? 'fixed right-6 z-40' : ''}
        `}
        style={isFloating ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' } : undefined}
      >
        <button
          onClick={handleClick}
          disabled={disabled || isProcessing}
          className={`
            w-16 h-16 rounded-full flex items-center justify-center
            shadow-lg transition-all duration-200
            ${isRecording
              ? 'scale-110'
              : isProcessing
                ? ''
                : 'bg-[var(--primary)] hover:scale-105'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          style={{
            backgroundColor: isRecording
              ? 'var(--error)'
              : isProcessing
                ? 'var(--text-muted)'
                : undefined
          }}
          onMouseEnter={(e) => {
            if (!isRecording && !isProcessing) {
              e.currentTarget.style.backgroundColor = 'var(--primary-dark)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRecording && !isProcessing) {
              e.currentTarget.style.backgroundColor = '';
            }
          }}
        >
          {isProcessing ? (
            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg
              className="w-7 h-7 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Recording overlay */}
      {isRecording && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
          onClick={stopRecording}
        >
          {/* Pulsing circle visualization */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Outer rings that pulse with audio level */}
            <div
              className="absolute rounded-full bg-[var(--primary)] opacity-20 transition-transform duration-75"
              style={{
                width: `${120 + audioLevel * 80}%`,
                height: `${120 + audioLevel * 80}%`,
              }}
            />
            <div
              className="absolute rounded-full bg-[var(--primary)] opacity-30 transition-transform duration-75"
              style={{
                width: `${100 + audioLevel * 50}%`,
                height: `${100 + audioLevel * 50}%`,
              }}
            />
            {/* Center circle */}
            <div className="w-32 h-32 rounded-full bg-[var(--primary)] flex items-center justify-center">
              <svg
                className="w-16 h-16 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
          </div>

          {/* Timer */}
          <div className="mt-8 text-white text-center">
            <div className="text-4xl font-light tabular-nums">
              {formatTime(recordingTime)}
            </div>
            <div className="text-sm text-white/60 mt-2">
              {formatTime(remainingTime)} remaining
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6 w-64 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Instructions */}
          <div className="mt-8 text-white/80 text-center">
            <p className="text-lg">Listening...</p>
            <p className="text-sm text-white/50 mt-2">
              Tap anywhere to stop
            </p>
          </div>

          {/* Cancel button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              cancelRecording();
            }}
            className="text-white/60 hover:text-white text-sm font-medium transition-colors"
            style={{ marginTop: '32px' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div
          className={`
            text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse
            ${isFloating ? 'fixed bottom-28 right-6' : 'absolute mt-2'}
          `}
          style={{ backgroundColor: 'var(--error)' }}
        >
          {error}
        </div>
      )}
    </>
  );
}
