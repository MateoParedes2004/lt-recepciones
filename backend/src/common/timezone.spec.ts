import {
  paraguayTodayIndex,
  paraguayTodayUtc,
  paraguayToUtc,
  utcToParaguayDate,
} from './timezone';

// Paraguay: UTC-3 fijo desde octubre de 2024 (sin horario de verano).
describe('timezone (Paraguay, UTC-3)', () => {
  it('la medianoche de Paraguay es las 03:00 UTC', () => {
    expect(paraguayToUtc(2026, 11, 15).toISOString()).toBe(
      '2026-11-15T03:00:00.000Z',
    );
    expect(paraguayToUtc(2026, 7, 15, 8, 30).toISOString()).toBe(
      '2026-07-15T11:30:00.000Z',
    ); // en julio tampoco cambia: no hay horario de verano
  });

  it('el día cambia a las 03:00 UTC, no a las 04:00', () => {
    // 00:30 del 15/11 en Paraguay = 03:30 UTC: ya es 15, no todavía 14.
    expect(utcToParaguayDate(new Date('2026-11-15T03:30:00Z'))).toEqual({
      year: 2026,
      month: 11,
      day: 15,
    });
    // 23:59 del 14/11 en Paraguay = 02:59 UTC del 15: sigue siendo 14.
    expect(utcToParaguayDate(new Date('2026-11-15T02:59:00Z'))).toEqual({
      year: 2026,
      month: 11,
      day: 14,
    });
  });

  it('ida y vuelta: paraguayToUtc y utcToParaguayDate son inversas', () => {
    const local = paraguayToUtc(2027, 1, 1, 0, 0);
    expect(utcToParaguayDate(local)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(utcToParaguayDate(new Date(local.getTime() - 1))).toEqual({
      year: 2026,
      month: 12,
      day: 31,
    });
  });

  it('"hoy" en Paraguay: instante real y fecha de calendario', () => {
    const now = new Date('2026-11-15T03:10:00Z'); // 00:10 del 15 en Paraguay
    expect(paraguayTodayUtc(now).toISOString()).toBe(
      '2026-11-15T03:00:00.000Z',
    );
    expect(new Date(paraguayTodayIndex(now) * 86_400_000).toISOString()).toBe(
      '2026-11-15T00:00:00.000Z',
    );
  });
});
