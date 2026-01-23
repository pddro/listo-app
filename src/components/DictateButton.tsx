'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API, getSupabaseHeaders } from '@/lib/api';

// Get Supabase anon key for auth header
const isVite = typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined';
const SUPABASE_ANON_KEY = isVite
  ? import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  : '';

interface DictateButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  position?: 'floating' | 'inline';
}

const MAX_RECORDING_TIME = 90000; // 90 seconds

export function DictateButton({ onTranscription, disabled = false, position = 'floating' }: DictateButtonProps) {
  const { t } = useTranslation();
  const tDictation = (key: string, params?: Record<string, string | number>) => t(`dictation.${key}`, params);
  const tErrors = (key: string) => t(`errors.${key}`);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
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

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [error]);

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
      console.log('[Dictation] Starting recording...');
      setError(null);
      audioChunksRef.current = [];
      cancelledRef.current = false;

      console.log('[Dictation] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Dictation] Microphone permission granted, stream:', stream.id);

      // Set up audio analysis
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start analyzing
      analyzeAudio();

      // Set up MediaRecorder with supported mimeType
      // iOS doesn't support webm, so we need to detect what's available
      let mimeType = 'audio/webm;codecs=opus';
      console.log('[Dictation] Checking MIME type support...');
      console.log('[Dictation] webm;opus supported:', MediaRecorder.isTypeSupported(mimeType));
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Try mp4 (iOS)
        mimeType = 'audio/mp4';
        console.log('[Dictation] audio/mp4 supported:', MediaRecorder.isTypeSupported(mimeType));
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          // Fallback to default (let browser choose)
          mimeType = '';
          console.log('[Dictation] Using default MIME type');
        }
      }

      console.log('[Dictation] Creating MediaRecorder with mimeType:', mimeType || 'default');
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mimeTypeRef.current = mediaRecorder.mimeType || 'audio/webm';
      console.log('[Dictation] MediaRecorder created, actual mimeType:', mimeTypeRef.current);

      mediaRecorder.ondataavailable = (event) => {
        console.log('[Dictation] Data available, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[Dictation] MediaRecorder error:', event);
      };

      mediaRecorder.onstop = async () => {
        console.log('[Dictation] Recording stopped, chunks:', audioChunksRef.current.length);
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Stop animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Process the recorded audio (skip if cancelled)
        if (!cancelledRef.current && audioChunksRef.current.length > 0) {
          console.log('[Dictation] Processing audio...');
          await processAudio();
        } else {
          console.log('[Dictation] Skipping processing - cancelled:', cancelledRef.current, 'chunks:', audioChunksRef.current.length);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      console.log('[Dictation] Recording started');

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
      console.error('[Dictation] Failed to start recording:', err);
      setError(tDictation('microphoneDenied'));
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
      console.log('[Dictation] Creating blob from chunks...');
      console.log('[Dictation] Chunks count:', audioChunksRef.current.length);
      console.log('[Dictation] MIME type:', mimeTypeRef.current);

      const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
      console.log('[Dictation] Blob created, size:', audioBlob.size, 'type:', audioBlob.type);

      // Send to transcription API with auth header
      const formData = new FormData();
      formData.append('audio', audioBlob);

      console.log('[Dictation] Sending to API:', API.transcribe);
      console.log('[Dictation] Auth key present:', !!SUPABASE_ANON_KEY);

      const response = await fetch(API.transcribe, {
        method: 'POST',
        headers: getSupabaseHeaders(),
        body: formData,
      });

      console.log('[Dictation] API response status:', response.status);
      const data = await response.json();
      console.log('[Dictation] API response data:', data);

      if (!response.ok) {
        throw new Error(data.error || tErrors('transcriptionFailed'));
      }

      if (data.text) {
        console.log('[Dictation] Transcription successful:', data.text);
        onTranscription(data.text);
      } else {
        console.log('[Dictation] No text in response');
      }
    } catch (err) {
      console.error('[Dictation] Transcription error:', err);
      setError(err instanceof Error ? err.message : tErrors('transcriptionFailed'));
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
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
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

          {/* Listening label */}
          <p className="mt-6 text-lg text-white/80">{tDictation('listening')}</p>

          {/* Timer */}
          <div className="mt-4 text-white text-center">
            <div className="text-4xl font-light tabular-nums">
              {formatTime(recordingTime)}
            </div>
            <div className="text-sm text-white/60 mt-2">
              {tDictation('timeRemaining', { time: formatTime(remainingTime) })}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 w-64 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] transition-all duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Done button - large checkmark */}
          <button
            onClick={stopRecording}
            className="rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              width: '72px',
              height: '72px',
              marginTop: '56px',
              backgroundColor: 'var(--primary)',
            }}
          >
            <svg
              className="w-9 h-9 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>

          {/* Cancel button */}
          <button
            onClick={cancelRecording}
            className="text-white/60 hover:text-white text-base font-medium transition-colors active:opacity-60"
            style={{ marginTop: '24px', padding: '8px 16px' }}
          >
            {tDictation('cancel')}
          </button>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div
          className={`
            flex items-center gap-3 text-white px-5 py-3.5 rounded-2xl shadow-xl z-50
            ${isFloating ? 'fixed left-1/2 -translate-x-1/2' : 'mt-4'}
          `}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            bottom: isFloating ? 'calc(env(safe-area-inset-bottom, 0px) + 110px)' : undefined,
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--error)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <span className="text-sm font-medium flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
