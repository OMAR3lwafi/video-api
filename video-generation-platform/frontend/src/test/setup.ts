/**
 * Test setup configuration
 * Configures testing environment and global mocks
 */

import "@testing-library/jest-dom";
import "whatwg-fetch";
import { beforeAll, afterAll, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./mocks/server";

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: "error",
  });
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers();
});

// Clean up after the tests are finished
afterAll(() => {
  server.close();
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.options = options;
  }

  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;

  disconnect() {
    return null;
  }

  observe(element: Element) {
    // Trigger callback with mock entry
    this.callback(
      [
        {
          boundingClientRect: element.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: element.getBoundingClientRect(),
          isIntersecting: true,
          rootBounds: null,
          target: element,
          time: Date.now(),
        },
      ],
      this,
    );
  }

  unobserve() {
    return null;
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  callback: ResizeObserverCallback;

  disconnect() {
    return null;
  }

  observe(element: Element) {
    // Trigger callback with mock entry
    this.callback(
      [
        {
          target: element,
          contentRect: element.getBoundingClientRect(),
          borderBoxSize: [
            {
              blockSize: 100,
              inlineSize: 100,
            },
          ],
          contentBoxSize: [
            {
              blockSize: 100,
              inlineSize: 100,
            },
          ],
          devicePixelContentBoxSize: [
            {
              blockSize: 100,
              inlineSize: 100,
            },
          ],
        },
      ],
      this,
    );
  }

  unobserve() {
    return null;
  }
};

// Mock MutationObserver
global.MutationObserver = class MutationObserver {
  constructor(callback: MutationCallback) {
    this.callback = callback;
  }

  callback: MutationCallback;

  disconnect() {
    return null;
  }

  observe() {
    return null;
  }

  takeRecords(): MutationRecord[] {
    return [];
  }

  unobserve() {
    return null;
  }
};

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo and scroll methods
Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window, "scroll", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window, "scrollBy", {
  writable: true,
  value: vi.fn(),
});

// Mock Element.scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock URL methods
Object.defineProperty(URL, "createObjectURL", {
  writable: true,
  value: vi.fn().mockReturnValue("mocked-blob-url"),
});

Object.defineProperty(URL, "revokeObjectURL", {
  writable: true,
  value: vi.fn(),
});

// Mock HTMLMediaElement methods
Object.defineProperty(HTMLMediaElement.prototype, "play", {
  writable: true,
  value: vi.fn().mockImplementation(() => Promise.resolve()),
});

Object.defineProperty(HTMLMediaElement.prototype, "pause", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLMediaElement.prototype, "load", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(HTMLMediaElement.prototype, "canPlayType", {
  writable: true,
  value: vi.fn().mockReturnValue("probably"),
});

// Mock canvas context
HTMLCanvasElement.prototype.getContext = vi
  .fn()
  .mockImplementation((contextId) => {
    if (contextId === "2d") {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(4),
          width: 1,
          height: 1,
        })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(4),
          width: 1,
          height: 1,
        })),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 10 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
      };
    }
    return null;
  });

// Mock File and FileReader
global.File = class MockFile {
  constructor(bits: BlobPart[], filename: string, options?: FilePropertyBag) {
    this.name = filename;
    this.size = bits.reduce(
      (acc, bit) =>
        acc + (typeof bit === "string" ? bit.length : bit.byteLength || 0),
      0,
    );
    this.type = options?.type || "";
    this.lastModified = Date.now();
    this.webkitRelativePath = "";
  }

  name: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath: string;

  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size));
  }

  slice(): Blob {
    return new Blob();
  }

  stream(): ReadableStream<Uint8Array> {
    return new ReadableStream();
  }

  text(): Promise<string> {
    return Promise.resolve("");
  }
};

global.FileReader = class MockFileReader {
  constructor() {
    this.readyState = FileReader.EMPTY;
  }

  static readonly EMPTY = 0;
  static readonly LOADING = 1;
  static readonly DONE = 2;

  readyState: number;
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null =
    null;
  onloadstart:
    | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
    | null = null;
  onprogress:
    | ((this: FileReader, ev: ProgressEvent<FileReader>) => any)
    | null = null;

  abort() {
    this.readyState = FileReader.DONE;
  }

  readAsArrayBuffer(file: Blob) {
    this.readyState = FileReader.LOADING;
    setTimeout(() => {
      this.readyState = FileReader.DONE;
      this.result = new ArrayBuffer(file.size);
      this.onload?.({} as ProgressEvent<FileReader>);
    }, 0);
  }

  readAsBinaryString(file: Blob) {
    this.readyState = FileReader.LOADING;
    setTimeout(() => {
      this.readyState = FileReader.DONE;
      this.result = "binary-string-content";
      this.onload?.({} as ProgressEvent<FileReader>);
    }, 0);
  }

  readAsDataURL(file: Blob) {
    this.readyState = FileReader.LOADING;
    setTimeout(() => {
      this.readyState = FileReader.DONE;
      this.result = `data:${file.type};base64,mock-base64-data`;
      this.onload?.({} as ProgressEvent<FileReader>);
    }, 0);
  }

  readAsText(file: Blob) {
    this.readyState = FileReader.LOADING;
    setTimeout(() => {
      this.readyState = FileReader.DONE;
      this.result = "mock-text-content";
      this.onload?.({} as ProgressEvent<FileReader>);
    }, 0);
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent(): boolean {
    return true;
  }
};

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
});

// Mock navigator
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
    readText: vi
      .fn()
      .mockImplementation(() => Promise.resolve("mock-clipboard-text")),
  },
  writable: true,
});

// Mock geolocation
Object.defineProperty(navigator, "geolocation", {
  value: {
    getCurrentPosition: vi.fn().mockImplementation((success) =>
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      }),
    ),
    watchPosition: vi.fn().mockReturnValue(1),
    clearWatch: vi.fn(),
  },
  writable: true,
});

// Mock Notification
global.Notification = class MockNotification {
  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.body = options?.body || "";
    this.icon = options?.icon || "";
    this.tag = options?.tag || "";
    this.data = options?.data;
  }

  static permission = "granted" as NotificationPermission;
  static requestPermission = vi
    .fn()
    .mockResolvedValue("granted" as NotificationPermission);

  title: string;
  body: string;
  icon: string;
  tag: string;
  data: any;
  onclick: ((this: Notification, ev: Event) => any) | null = null;
  onclose: ((this: Notification, ev: Event) => any) | null = null;
  onerror: ((this: Notification, ev: Event) => any) | null = null;
  onshow: ((this: Notification, ev: Event) => any) | null = null;

  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent(): boolean {
    return true;
  }
};

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.({} as Event);
    }, 100);
  }

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  url: string;
  readyState: number;
  onopen: ((this: WebSocket, ev: Event) => any) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
  onerror: ((this: WebSocket, ev: Event) => any) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;

  send(data: string | ArrayBuffer | Blob | ArrayBufferView) {
    // Mock send functionality
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent(): boolean {
    return true;
  }
};

// Mock console methods in tests to reduce noise
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render is no longer supported") ||
        args[0].includes("Warning: An invalid form control") ||
        args[0].includes(
          'Warning: Each child in a list should have a unique "key" prop',
        ))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("componentWillReceiveProps has been renamed") ||
        args[0].includes("componentWillMount has been renamed"))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test utilities
global.testUtils = {
  // Create mock event
  createMockEvent: (type: string, properties = {}) => ({
    type,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: {},
    currentTarget: {},
    ...properties,
  }),

  // Create mock file
  createMockFile: (name = "test.mp4", type = "video/mp4", size = 1024) =>
    new File(["mock-content"], name, { type, lastModified: Date.now() }),

  // Wait for next tick
  waitForNextTick: () => new Promise((resolve) => setTimeout(resolve, 0)),

  // Flush all promises
  flushPromises: () => new Promise((resolve) => setImmediate(resolve)),

  // Mock intersection observer entry
  createMockIntersectionEntry: (element: Element, isIntersecting = true) => ({
    target: element,
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
    boundingClientRect: element.getBoundingClientRect(),
    intersectionRect: isIntersecting
      ? element.getBoundingClientRect()
      : { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 },
    rootBounds: null,
    time: Date.now(),
  }),

  // Mock resize observer entry
  createMockResizeEntry: (
    element: Element,
    contentRect = { width: 100, height: 100 },
  ) => ({
    target: element,
    contentRect: {
      top: 0,
      left: 0,
      bottom: contentRect.height,
      right: contentRect.width,
      width: contentRect.width,
      height: contentRect.height,
      x: 0,
      y: 0,
    },
    borderBoxSize: [
      { blockSize: contentRect.height, inlineSize: contentRect.width },
    ],
    contentBoxSize: [
      { blockSize: contentRect.height, inlineSize: contentRect.width },
    ],
    devicePixelContentBoxSize: [
      { blockSize: contentRect.height, inlineSize: contentRect.width },
    ],
  }),
};
