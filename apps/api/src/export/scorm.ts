import JSZip from 'jszip';
import { getJourney } from '../db/journeyLoader';

/**
 * Generates a SCORM 1.2 zip package for a journey.
 */
export async function generateScormPackage(tenantId: string, journeyId: string): Promise<Buffer> {
  const journey = await getJourney(tenantId, journeyId);
  if (!journey) {
    throw new Error('Journey not found');
  }

  if (journey.status !== 'published') {
    throw new Error('Only published journeys can be exported');
  }

  const zip = new JSZip();

  // 1. Create HTML content for each step
  journey.steps.forEach((step, index) => {
    const isLast = index === journey.steps.length - 1;
    const nextLabel = isLast ? 'Finish' : 'Next Step';

    // For the final step, we'll report a score of 100 on completion as a default mapping.
    const scoreScript = isLast
      ? `
        api.LMSSetValue("cmi.core.score.raw", "100");
        api.LMSSetValue("cmi.core.score.min", "0");
        api.LMSSetValue("cmi.core.score.max", "100");
      `
      : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${step.title}</title>
    <style>
        body { font-family: sans-serif; padding: 2rem; line-height: 1.5; max-width: 800px; margin: 0 auto; }
        .card { border: 1px solid #e2e8f0; padding: 2rem; border-radius: 0.5rem; background: white; shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
        h1 { color: #1a202c; margin-top: 0; }
        p { color: #4a5568; font-size: 1.125rem; }
        button { background: #3182ce; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-size: 1rem; cursor: pointer; font-weight: 600; }
        button:hover { background: #2b6cb0; }
    </style>
    <script type="text/javascript">
        var api = null;
        function findAPI(win) {
            var nTries = 0;
            while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
                nTries++;
                if (nTries > 10) return null;
                win = win.parent;
            }
            return win.API;
        }
        function init() {
            api = findAPI(window);
            if (api) {
                api.LMSInitialize("");
                api.LMSSetValue("cmi.core.lesson_status", "incomplete");
                api.LMSCommit("");
            }
        }
        function finish() {
            if (api) {
                ${scoreScript}
                api.LMSSetValue("cmi.core.lesson_status", "completed");
                api.LMSCommit("");
                api.LMSFinish("");
            }
            alert("Step completed. You can now move to the next section in your LMS.");
        }
    </script>
</head>
<body onload="init()">
    <div class="card">
        <h1>${step.title}</h1>
        <p>${step.openingMessage}</p>
        <button onclick="finish()">${nextLabel}</button>
    </div>
</body>
</html>
    `;
    zip.file(`step_${index}.html`, htmlContent);
  });

  // 2. Create imsmanifest.xml
  const items = journey.steps.map((step, index) =>
    `<item identifier="item_${index}" identifierref="resource_${index}">
      <title>${step.title}</title>
    </item>`
  ).join('\n      ');

  const resources = journey.steps.map((step, index) =>
    `<resource identifier="resource_${index}" type="webcontent" adlcp:scormtype="sco" href="step_${index}.html">
      <file href="step_${index}.html"/>
    </resource>`
  ).join('\n    ');

  const manifestContent = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="CoachFlow_Journey_${journey.id}" version="1.1"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1 imscp_rootv1p1.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="coachflow_org">
    <organization identifier="coachflow_org">
      <title>${journey.title}</title>
      ${items}
    </organization>
  </organizations>
  <resources>
    ${resources}
  </resources>
</manifest>
  `;
  zip.file('imsmanifest.xml', manifestContent);

  // 3. Add adlcp_rootv1p2.xsd (stub/placeholder for validation if needed)
  const adlcpXsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema targetNamespace="http://www.adlnet.org/xsd/adlcp_rootv1p2"
           xmlns:xs="http://www.w3.org/2001/XMLSchema"
           xmlns="http://www.adlnet.org/xsd/adlcp_rootv1p2"
           elementFormDefault="qualified"
           version="1.2">
  <xs:element name="scormtype">
    <xs:simpleType>
      <xs:restriction base="xs:string">
        <xs:enumeration value="sco"/>
        <xs:enumeration value="asset"/>
      </xs:restriction>
    </xs:simpleType>
  </xs:element>
</xs:schema>
  `;
  zip.file('adlcp_rootv1p2.xsd', adlcpXsd);

  return zip.generateAsync({ type: 'nodebuffer' });
}
