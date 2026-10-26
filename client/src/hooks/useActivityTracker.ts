/**
 * useActivityTracker
 *
 * Tracks member activity events and batches them to the server every 30 seconds
 * (or on page unload). Tracks:
 *   - page_view / page_exit (with time-on-page)
 *   - session_start / session_heartbeat / session_end
 *   - video_play / video_pause / video_seek / video_complete / video_progress
 *   - lesson_start / lesson_complete
 *   - button_click / link_click / download
 *
 * Usage:
 *   // In a top-level LMS layout component:
 *   useActivityTracker({ orgId, courseId?, lessonId? });
 *
 *   // To track a video element:
 *   const { trackVideoElement } = useActivityTracker({ orgId });
 *   useEffect(() => { if (videoRef.current) trackVideoElement(videoRef.current); }, []);
 */

import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { nanoid } from "nanoid";

type EventType =
  | "page_view" | "page_exit" | "session_start" | "session_heartbeat" | "session_end"
  | "video_play" | "video_pause" | "video_seek" | "video_complete" | "video_progress"
  | "lesson_start" | "lesson_complete" | "quiz_start" | "quiz_submit"
  | "download" | "link_click" | "button_click" | "search" | "enrollment" | "course_complete";

interface ActivityEvent {
  sessionKey: string;
  eventType: EventType;
  pageUrl?: string;
  pageTitle?: string;
  courseId?: number | null;
  lessonId?: number | null;
  quizId?: number | null;
  durationMs?: number | null;
  videoPositionSec?: number | null;
  videoDurationSec?: number | null;
  metadata?: Record<string, unknown> | null;
  referrer?: string;
}

interface TrackerOptions {
  orgId: number;
  courseId?: number;
  lessonId?: number;
  quizId?: number;
  enabled?: boolean;
}

// Shared session key across all tracker instances on the same page load
const SESSION_KEY = nanoid(16);
const FLUSH_INTERVAL_MS = 30_000; // flush every 30 seconds
const HEARTBEAT_INTERVAL_MS = 60_000; // heartbeat every 60 seconds

export function useActivityTracker(opts: TrackerOptions) {
  const { orgId, courseId, lessonId, quizId, enabled = true } = opts;
  const logMutation = trpc.lms.activity.log.useMutation();
  const pageEnterTimeRef = useRef<number>(Date.now());
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef<ActivityEvent[]>([]);

  const enqueue = useCallback((event: Omit<ActivityEvent, "sessionKey">) => {
    if (!enabled) return;
    queueRef.current.push({
      ...event,
      sessionKey: SESSION_KEY,
      pageUrl: event.pageUrl ?? window.location.pathname,
      pageTitle: event.pageTitle ?? document.title,
      referrer: event.referrer ?? (document.referrer || undefined),
    });
  }, [enabled]);

  const flush = useCallback(() => {
    if (!queueRef.current.length || !enabled || logMutation.isPending) return;
    const batch = queueRef.current.splice(0, 50);
    logMutation.mutate({ orgId, events: batch }, {
      onError: () => {
        // Keep a bounded retry buffer. Activity telemetry must never interfere
        // with the learner experience if the network is briefly unavailable.
        const remainingCapacity = Math.max(0, 50 - queueRef.current.length);
        queueRef.current.unshift(...batch.slice(0, remainingCapacity));
      },
    });
  }, [orgId, enabled, logMutation]);

  // Track page view on mount, page exit on unmount
  useEffect(() => {
    if (!enabled) return;
    pageEnterTimeRef.current = Date.now();
    enqueue({ eventType: "page_view", courseId, lessonId, quizId });

    return () => {
      const durationMs = Date.now() - pageEnterTimeRef.current;
      enqueue({ eventType: "page_exit", courseId, lessonId, quizId, durationMs });
      flush();
    };
  }, [enabled, courseId, lessonId, quizId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Session start on first mount
  useEffect(() => {
    if (!enabled) return;
    const key = `activity_session_${orgId}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      enqueue({ eventType: "session_start", courseId });
    }
  }, [enabled, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic flush
  useEffect(() => {
    if (!enabled) return;
    flushTimerRef.current = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, [flush, enabled]);

  // Session heartbeat
  useEffect(() => {
    if (!enabled) return;
    heartbeatTimerRef.current = setInterval(() => {
      enqueue({ eventType: "session_heartbeat", courseId, durationMs: HEARTBEAT_INTERVAL_MS });
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [enabled, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush on page unload
  useEffect(() => {
    if (!enabled) return;
    const handleUnload = () => {
      enqueue({ eventType: "session_end", courseId, durationMs: Date.now() - pageEnterTimeRef.current });
      // Flush while React is still mounted; unsent telemetry is non-critical.
      flush();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [enabled, orgId, courseId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Attach activity tracking to an HTML video element.
   * Call this in a useEffect after the video ref is available.
   */
  const trackVideoElement = useCallback(
    (video: HTMLVideoElement) => {
      if (!enabled) return () => {};

      const milestones = new Set<number>();

      const onPlay = () => enqueue({
        eventType: "video_play",
        courseId, lessonId,
        videoPositionSec: video.currentTime,
        videoDurationSec: video.duration || null,
      });
      const onPause = () => enqueue({
        eventType: "video_pause",
        courseId, lessonId,
        videoPositionSec: video.currentTime,
        videoDurationSec: video.duration || null,
      });
      const onSeeked = () => enqueue({
        eventType: "video_seek",
        courseId, lessonId,
        videoPositionSec: video.currentTime,
        videoDurationSec: video.duration || null,
      });
      const onEnded = () => {
        enqueue({
          eventType: "video_complete",
          courseId, lessonId,
          videoPositionSec: video.duration,
          videoDurationSec: video.duration || null,
        });
        flush();
      };
      const onTimeUpdate = () => {
        if (!video.duration) return;
        const pct = Math.floor((video.currentTime / video.duration) * 100);
        for (const milestone of [25, 50, 75]) {
          if (pct >= milestone && !milestones.has(milestone)) {
            milestones.add(milestone);
            enqueue({
              eventType: "video_progress",
              courseId, lessonId,
              videoPositionSec: video.currentTime,
              videoDurationSec: video.duration,
              metadata: { percent: milestone },
            });
          }
        }
      };

      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("seeked", onSeeked);
      video.addEventListener("ended", onEnded);
      video.addEventListener("timeupdate", onTimeUpdate);

      return () => {
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("timeupdate", onTimeUpdate);
      };
    },
    [enabled, courseId, lessonId, enqueue, flush]
  );

  /**
   * Track a specific button or link click.
   */
  const trackClick = useCallback(
    (label: string, eventType: "button_click" | "link_click" | "download" = "button_click") => {
      if (!enabled) return;
      enqueue({
        eventType,
        courseId, lessonId,
        metadata: { label },
      });
    },
    [enabled, courseId, lessonId, enqueue]
  );

  /**
   * Track lesson start/complete manually.
   */
  const trackLesson = useCallback(
    (action: "lesson_start" | "lesson_complete") => {
      if (!enabled) return;
      enqueue({ eventType: action, courseId, lessonId });
    },
    [enabled, courseId, lessonId, enqueue]
  );

  return { enqueue, flush, trackVideoElement, trackClick, trackLesson };
}
