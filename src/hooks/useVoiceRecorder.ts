import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder, RecordingData } from 'capacitor-voice-recorder';

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  recordingTime: number;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
}

const MAX_RECORDING_TIME = 90000; // 90 seconds

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const isNative = Capacitor.isNativePlatform();

  // Browser-specific refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

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

  // Analyze audio levels for visualization (browser only)
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);

    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  const startRecording = async () => {
    try {
      setError(null);

      if (isNative) {
        // Native recording using Capacitor plugin
        const permissionResult = await VoiceRecorder.requestAudioRecordingPermission();
        if (!permissionResult.value) {
          throw new Error('Microphone permission denied');
        }

        await VoiceRecorder.startRecording();
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
      } else {
        // Browser recording using MediaRecorder
        audioChunksRef.current = [];

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

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(100);

        setIsRecording(true);
        startTimeRef.current = Date.now();

        // Timer for display
        timerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTimeRef.current;
          setRecordingTime(elapsed);

          if (elapsed >= MAX_RECORDING_TIME) {
            stopRecording();
          }
        }, 100);
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  };

  const stopRecording = async (): Promise<Blob | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isNative) {
      try {
        const result: RecordingData = await VoiceRecorder.stopRecording();
        setIsRecording(false);
        setRecordingTime(0);

        if (result.value && result.value.recordDataBase64) {
          // Convert base64 to Blob
          const byteCharacters = atob(result.value.recordDataBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const mimeType = result.value.mimeType || 'audio/aac';
          return new Blob([byteArray], { type: mimeType });
        }
        return null;
      } catch (err) {
        console.error('Failed to stop native recording:', err);
        setError(err instanceof Error ? err.message : 'Recording failed');
        setIsRecording(false);
        setRecordingTime(0);
        return null;
      }
    } else {
      // Browser: stop MediaRecorder
      return new Promise((resolve) => {
        if (!mediaRecorderRef.current || !isRecording) {
          resolve(null);
          return;
        }

        mediaRecorderRef.current.onstop = () => {
          // Stop all tracks
          mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());

          // Stop animation
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }

          setIsRecording(false);
          setAudioLevel(0);
          setRecordingTime(0);

          if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            resolve(audioBlob);
          } else {
            resolve(null);
          }
        };

        mediaRecorderRef.current.stop();
      });
    }
  };

  return {
    isRecording,
    isProcessing,
    error,
    recordingTime,
    audioLevel,
    startRecording,
    stopRecording,
  };
}
