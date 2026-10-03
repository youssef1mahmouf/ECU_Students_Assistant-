'use strict';
/* Checks the library file endpoint: a real file streams back, while traversal attempts and
   unlisted names are refused. Run while a server is listening on PORT (default 3100). */
const PORT = process.env.PORT || 3100;
const BASE = `http://127.0.0.1:${PORT}`;

const CASES = [
  ['real PDF', 'Mathematics/Week 1/Lecture 1 Functions Basics/PDF/Function-sheet.pdf', 200],
  ['traversal', '../../../../etc/passwd', 404],
  ['traversal via segment', 'Mathematics/../../secrets.txt', 404],
  ['unlisted name', 'secret.txt', 404],
  ['absolute path', 'C:/Windows/win.ini', 404],
];

(async () => {
  let failures = 0;
  for (const [label, path, expected] of CASES) {
    const url = `${BASE}/api/public/material-library/file?path=${encodeURIComponent(path)}`;
    let status = 0;
    let bytes = 0;
    try {
      const res = await fetch(url);
      status = res.status;
      bytes = (await res.arrayBuffer()).byteLength;
    } catch (error) {
      console.log(`FAIL  ${label}: ${error.message}`);
      failures += 1;
      continue;
    }
    const ok = status === expected;
    if (!ok) failures += 1;
    console.log(`${ok ? 'OK   ' : 'FAIL '} ${label.padEnd(22)} ${status} (${bytes} bytes, wanted ${expected})`);
  }
  console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();