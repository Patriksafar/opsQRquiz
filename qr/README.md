# QR codes

All three encode the same URL:

    https://opsquiz.onrender.com/solo

| File | Use |
|------|-----|
| `solo-quiz-brand.png` | Yellow on plum, matching the app. Slides and screens. 1600px. |
| `solo-quiz-print.png` | Black on white. Print and posters. 1600px. |
| `solo-quiz.svg` | Vector. Scales to any size without softening the edges. |

Error correction is level **H** (30% recoverable), so the code still scans
through print glare, an angled phone, or a logo dropped in the middle. The URL
is short enough that the redundancy costs almost no density.

## Regenerating

If the URL changes, these must be regenerated — a QR code is just an encoding
of the string, so the files above are stale the moment the address moves.

```bash
npx tsx -e '
import QRCode from "qrcode";
import { writeFileSync } from "node:fs";
const url = "https://opsquiz.onrender.com/solo";
const common = { errorCorrectionLevel: "H" as const, margin: 2 };
await QRCode.toFile("qr/solo-quiz-brand.png", url, { ...common, width: 1600, color: { dark: "#FFEE00", light: "#241424" } });
await QRCode.toFile("qr/solo-quiz-print.png", url, { ...common, width: 1600, color: { dark: "#000000", light: "#FFFFFF" } });
writeFileSync("qr/solo-quiz.svg", await QRCode.toString(url, { ...common, type: "svg", color: { dark: "#000000", light: "#FFFFFF" } }));
'
```

Note the live **display** view (`/display`) generates its own QR at runtime from
whatever host the browser is on, so it never needs these files. These are for
printing and slides, where the URL has to be hard-coded.
