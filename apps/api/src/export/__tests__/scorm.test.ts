import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateScormPackage } from '../scorm';
import { getJourney } from '../../db/journeyLoader';
import JSZip from 'jszip';

vi.mock('../../db/journeyLoader', () => ({
  getJourney: vi.fn(),
}));

describe('generateScormPackage', () => {
  const mockJourney = {
    id: 'test-journey-id',
    title: 'Test Journey',
    status: 'published',
    steps: [
      {
        id: 'step-1',
        title: 'Step 1',
        openingMessage: 'Welcome to Step 1',
      },
      {
        id: 'step-2',
        title: 'Step 2',
        openingMessage: 'Welcome to Step 2',
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a valid SCORM zip package', async () => {
    vi.mocked(getJourney).mockResolvedValue(mockJourney as any);

    const buffer = await generateScormPackage('tenant-1', 'test-journey-id');
    expect(buffer).toBeDefined();

    const zip = await JSZip.loadAsync(buffer);

    // Check for required files
    expect(zip.file('imsmanifest.xml')).not.toBeNull();
    expect(zip.file('adlcp_rootv1p2.xsd')).not.toBeNull();
    expect(zip.file('step_0.html')).not.toBeNull();
    expect(zip.file('step_1.html')).not.toBeNull();

    // Verify imsmanifest.xml content
    const manifest = await zip.file('imsmanifest.xml')!.async('string');
    expect(manifest).toContain('<title>Test Journey</title>');
    expect(manifest).toContain('href="step_0.html"');
    expect(manifest).toContain('href="step_1.html"');

    // Verify HTML content
    const step0Html = await zip.file('step_0.html')!.async('string');
    expect(step0Html).toContain('<h1>Step 1</h1>');
    expect(step0Html).toContain('<p>Welcome to Step 1</p>');
    expect(step0Html).toContain('LMSInitialize');
  });

  it('should throw error if journey is not found', async () => {
    vi.mocked(getJourney).mockResolvedValue(null);

    await expect(generateScormPackage('tenant-1', 'invalid-id'))
      .rejects.toThrow('Journey not found');
  });

  it('should throw error if journey is not published', async () => {
    vi.mocked(getJourney).mockResolvedValue({ ...mockJourney, status: 'draft' } as any);

    await expect(generateScormPackage('tenant-1', 'test-journey-id'))
      .rejects.toThrow('Only published journeys can be exported');
  });
});
