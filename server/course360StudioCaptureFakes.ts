import { vi } from "vitest";
export class FakeTrack {
  enabled = true; readyState = "live"; listeners = new Map<string, Set<() => void>>();
  stop = vi.fn(() => { this.readyState = "ended"; });
  constructor(public kind: "video" | "audio", public label: string, private settings: any = {}) {}
  getSettings() { return this.settings; }
  clone() { return new FakeTrack(this.kind, `${this.label}-clone`, this.settings); }
  addEventListener(type: string, listener: () => void) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(listener); }
  removeEventListener(type: string, listener: () => void) { this.listeners.get(type)?.delete(listener); }
  end() { this.listeners.get("ended")?.forEach(listener => listener()); }
}
export class FakeStream {
  constructor(public tracks: FakeTrack[] = []) {}
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(track => track.kind === "video"); }
  getAudioTracks() { return this.tracks.filter(track => track.kind === "audio"); }
}
export class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supported = ["video/webm;codecs=vp8,opus", "audio/mp4"];
  static isTypeSupported = (mime: string) => FakeRecorder.supported.includes(mime);
  state = "inactive"; mimeType: string;
  ondataavailable?: (event: any) => void; onstop?: () => void; onerror?: (event: any) => void;
  constructor(public stream: FakeStream, public options: any) { this.mimeType = options?.mimeType ?? (stream.getVideoTracks().length ? "video/webm" : "audio/webm"); FakeRecorder.instances.push(this); }
  start = vi.fn(() => { this.state = "recording"; });
  pause = vi.fn(() => { this.state = "paused"; });
  resume = vi.fn(() => { this.state = "recording"; });
  stop = vi.fn(() => { if (this.state === "inactive") return; this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["fake media bytes"], { type: this.mimeType }) }); this.onstop?.(); });
}
export class FakeAudioNode {
  gain = { value: 1 }; fftSize = 0; frequencyBinCount = 16;
  connect = vi.fn(); disconnect = vi.fn(); getByteTimeDomainData(data: Uint8Array) { data.fill(128); }
}
export class FakeAudio {
  static instances: FakeAudio[] = [];
  stream = new FakeStream([new FakeTrack("audio", "mixed")]); nodes: FakeAudioNode[] = [];
  resume = vi.fn(async () => {}); close = vi.fn(async () => {});
  constructor() { FakeAudio.instances.push(this); }
  createMediaStreamDestination() { const node = Object.assign(new FakeAudioNode(), { stream: this.stream }); this.nodes.push(node); return node; }
  createMediaStreamSource = vi.fn((_stream: FakeStream) => { const node = new FakeAudioNode(); this.nodes.push(node); return node; });
  createGain() { const node = new FakeAudioNode(); this.nodes.push(node); return node; }
  createAnalyser() { const node = new FakeAudioNode(); this.nodes.push(node); return node; }
}
export function captureFixture() {
  FakeRecorder.instances = []; FakeAudio.instances = [];
  const screen = new FakeStream([new FakeTrack("video", "screen", { width: 1280, height: 720, frameRate: 24 }), new FakeTrack("audio", "system")]);
  const camera = new FakeStream([new FakeTrack("video", "camera", { width: 640, height: 480, frameRate: 30 })]);
  const mic = new FakeStream([new FakeTrack("audio", "mic")]);
  const context = { fillStyle: "", fillRect: vi.fn(), clearRect: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), drawImage: vi.fn(), save: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), clip: vi.fn(), translate: vi.fn(), scale: vi.fn(), restore: vi.fn() };
  const canvas = { width: 0, height: 0, getContext: () => context, captureStream: vi.fn(() => new FakeStream([new FakeTrack("video", "composite")])) };
  const videos: any[] = [];
  const document = { createElement: (type: string) => {
    if (type === "canvas") return canvas;
    const video = { muted: false, playsInline: false, srcObject: null, videoWidth: 640, videoHeight: 480, play: vi.fn(async () => {}), pause: vi.fn() }; videos.push(video); return video;
  } };
  const devices = { getDisplayMedia: vi.fn(async () => screen), getUserMedia: vi.fn(async (options: any) => options.video ? camera : mic), enumerateDevices: vi.fn(async () => []), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const deps = { devices, Recorder: FakeRecorder, Stream: FakeStream, Audio: FakeAudio, document, now: () => Date.now(), setInterval, clearInterval, id: () => "stable-recording-id" } as any;
  return { screen, camera, mic, devices, context, canvas, videos, deps };
}
