import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../ports/clock.port';

@Injectable()
export class ClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }

  timestamp(): number {
    return Date.now();
  }
}
