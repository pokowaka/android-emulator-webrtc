export class KeyboardEvent {
  static KeyEventType: {
    KEYDOWN: number;
    KEYUP: number;
    KEYPRESS: number;
  };
  setEventtype(type: number): void;
  setKey(key: string): void;
  serializeBinary(): Uint8Array;
}

export class MouseEvent {
  setX(x: number): void;
  setY(y: number): void;
  setButtons(buttons: number): void;
  serializeBinary(): Uint8Array;
}

export class Touch {
  setX(x: number): void;
  setY(y: number): void;
  setIdentifier(id: number): void;
  setPressure(pressure: number): void;
  setTouchMajor(major: number): void;
  setTouchMinor(minor: number): void;
}

export class TouchEvent {
  setTouchesList(touches: Touch[]): void;
  serializeBinary(): Uint8Array;
}
