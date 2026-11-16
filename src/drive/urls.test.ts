import { expect, test } from 'vitest'
import { thumbnailUrl, videoPreviewUrl } from './urls'

test('thumbnailUrl', () => {
  expect(thumbnailUrl('abc')).toBe('https://drive.google.com/thumbnail?id=abc&sz=w400')
  expect(thumbnailUrl('abc', 1600)).toBe('https://drive.google.com/thumbnail?id=abc&sz=w1600')
})

test('videoPreviewUrl', () => {
  expect(videoPreviewUrl('abc')).toBe('https://drive.google.com/file/d/abc/preview')
})
