import { describe, expect, it } from 'vitest';
import { chooseSize, tileFor } from './layout';

const touch = (width: number, height = 900) => ({ width, height, finePointer: false });
const mouse = (width: number, height: number) => ({ width, height, finePointer: true });

describe('chooseSize', () => {
  it('touch: largest of 6..10 fitting 44px tiles by width, height ignored', () => {
    expect(chooseSize(touch(440))).toBe(10);
    expect(chooseSize(touch(439))).toBe(9);
    expect(chooseSize(touch(338))).toBe(7);
    expect(chooseSize(touch(264))).toBe(6);
    expect(chooseSize(touch(2000))).toBe(10);
    expect(chooseSize(touch(440, 10))).toBe(10);
  });

  it('mouse: 15 when 15 x 36 fits both ways, else largest of 6..10 at 36px', () => {
    expect(chooseSize(mouse(940, 700))).toBe(15);
    expect(chooseSize(mouse(940, 530))).toBe(10);
    expect(chooseSize(mouse(500, 900))).toBe(10);
    expect(chooseSize(mouse(300, 900))).toBe(8);
  });

  it('never goes below 6, even for junk input', () => {
    expect(chooseSize(mouse(200, 200))).toBe(6);
    expect(chooseSize(touch(0))).toBe(6);
    expect(chooseSize(touch(NaN))).toBe(6);
    expect(chooseSize(mouse(-5, Infinity))).toBe(6);
  });
});

describe('tileFor', () => {
  it('touch: min(48, width / size), height ignored', () => {
    expect(tileFor(7, touch(338))).toBe(48);
    expect(tileFor(8, touch(360))).toBe(45);
    expect(tileFor(6, touch(200))).toBeCloseTo(200 / 6);
    expect(tileFor(10, touch(480, 300))).toBe(48);
  });

  it('mouse: also limited by height', () => {
    expect(tileFor(15, mouse(940, 700))).toBeCloseTo(700 / 15);
    expect(tileFor(15, mouse(940, 1000))).toBe(48);
    expect(tileFor(15, mouse(940, 450))).toBe(30);
  });

  it('is finite and never negative', () => {
    expect(tileFor(6, touch(0))).toBe(0);
    expect(tileFor(6, mouse(720, -5))).toBe(0);
    expect(tileFor(6, touch(NaN))).toBe(0);
    expect(tileFor(6, mouse(Infinity, Infinity))).toBe(0);
  });
});
