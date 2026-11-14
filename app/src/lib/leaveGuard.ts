let skipUntil = 0;

export function skipLeaveGuard(ms = 2000): void {
  skipUntil = Date.now() + ms;
}

export function leaveGuardSkipped(): boolean {
  return Date.now() < skipUntil;
}