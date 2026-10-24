// ─────────────────────────────────────────────────────────────
// VERIFICATION ENGINE
// "Completed" is not the same as "marked complete". Every task has a
// verificationType, and only a VERIFIED result opens the next tier.
//
// Every verifier returns the same result shape:
//   { status: 'VERIFIED' | 'REJECTED', confidence: number | null, source: string }
//
// confidence is null unless a real model produced one. The mocks
// below never invent a confidence score.
// ─────────────────────────────────────────────────────────────

export const VERIFICATION = {
  MANUAL: { label: 'Manual', icon: 'check-square', action: 'Mark complete' },
  CAMERA: { label: 'Camera', icon: 'camera', action: 'Verify with camera' },
  TIMER: { label: 'Timer', icon: 'clock', action: 'Start timer' },
  DEVICE: { label: 'Focus', icon: 'smartphone', action: 'Start focus' },
};

export const VERIFICATION_TYPES = Object.keys(VERIFICATION);

// TIMER and DEVICE tasks run for their estimated minutes first and
// are checked when the time is up.
export function isTimed(type) {
  return type === 'TIMER' || type === 'DEVICE';
}

export function timeLeftMs(task, now = Date.now()) {
  if (!task.startedAt) return task.estimatedMinutes * 60 * 1000;
  return Math.max(0, task.startedAt + task.estimatedMinutes * 60 * 1000 - now);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const verifiers = {
  // The user's word is the check. Use for things a camera can't see,
  // like "Submit assignment".
  MANUAL: async () => ({ status: 'VERIFIED', confidence: null, source: 'user' }),

  // Verified once the full time has run.
  TIMER: async (task, { now = Date.now() } = {}) => ({
    status: timeLeftMs(task, now) === 0 ? 'VERIFIED' : 'REJECTED',
    confidence: null,
    source: 'timer',
  }),

  // SIMULATED. No image is captured or analysed. It waits, then passes.
  // TODO(AI vision): replace with a real verifier, e.g.
  //   registerVerifier('CAMERA', async (task) => {
  //     const frames = await camera.capture();           // before/after frames
  //     const res = await visionModel.check(frames, task); // hosted API or on-device model
  //     return { status: res.passed ? 'VERIFIED' : 'REJECTED',
  //              confidence: res.confidence, source: 'vision-model' };
  //   });
  CAMERA: async () => {
    await wait(1800);
    return { status: 'VERIFIED', confidence: null, source: 'simulated-camera' };
  },

  // Passes when the focus window ends. App blocking itself is real on
  // Android (modules/notch-guard), but this check doesn't look at
  // usage. TODO: reject if a blocked app was used during the window,
  // e.g. via UsageStatsManager.
  DEVICE: async (task, { now = Date.now() } = {}) => {
    await wait(600);
    return {
      status: timeLeftMs(task, now) === 0 ? 'VERIFIED' : 'REJECTED',
      confidence: null,
      source: 'simulated-device',
    };
  },
};

// Swap in a real verifier for a type without touching the UI.
export function registerVerifier(type, verifier) {
  verifiers[type] = verifier;
}

export async function verifyTask(task, context = {}) {
  const verifier = verifiers[task.verificationType] ?? verifiers.MANUAL;
  try {
    return await verifier(task, context);
  } catch (error) {
    return { status: 'REJECTED', confidence: null, source: 'error', error: String(error) };
  }
}

// ─────────────────────────────────────────────────────────────
// NOTCH DEVICE CONTRACT
// The physical Notch device (camera → vision model → verification)
// plugs in here. It only has to expose:
//
//   device.verify(task) → Promise<{ status, confidence, source }>
//
// where `task` is { id, title, cognitiveMode, verificationType, ... }.
//
// TODO(Notch hardware): build the transport (BLE, local Wi-Fi or a
// cloud relay) that turns device.verify into a request to the device.
// ─────────────────────────────────────────────────────────────
export function connectNotchDevice(device) {
  registerVerifier('CAMERA', (task) => device.verify(task));
}
